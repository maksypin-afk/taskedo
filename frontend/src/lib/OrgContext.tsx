import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from './supabase';

export interface UserOrg {
    id: string;
    name: string;
    role: string; // 'owner' | 'member' | 'Manager' | 'Employee' etc.
    logo_url?: string | null;
    industry?: string;
}

interface OrgContextType {
    activeOrgId: string | null;
    activeOrgName: string | null;
    userOrgs: UserOrg[];
    loading: boolean;
    switchOrg: (orgId: string, forceOrg?: UserOrg) => void;
    refreshOrgs: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType>({
    activeOrgId: null,
    activeOrgName: null,
    userOrgs: [],
    loading: true,
    switchOrg: (_orgId: string, _forceOrg?: UserOrg) => { },
    refreshOrgs: async () => { },
});

export function useOrg() {
    return useContext(OrgContext);
}

export function OrgProvider({ children }: { children: ReactNode }) {
    const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
    const [activeOrgName, setActiveOrgName] = useState<string | null>(null);
    const [userOrgs, setUserOrgs] = useState<UserOrg[]>([]);
    const [loading, setLoading] = useState(true);

    const loadOrgs = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Get orgs where user is a team member (by user_id)
            const { data: memberRows } = await supabase
                .from('team_members')
                .select('organization_id, role')
                .eq('user_id', user.id);

            const memberOrgIds = [...new Set((memberRows || []).map(r => r.organization_id).filter(Boolean))];

            // Map of orgId -> role
            const memberRoles = new Map<string, string>();
            memberRows?.forEach(r => {
                if (r.organization_id) memberRoles.set(r.organization_id, r.role);
            });

            // 2. Get orgs where user is the owner
            const { data: ownedOrgs } = await supabase
                .from('organizations')
                .select('id, name, logo_url, industry')
                .eq('owner_id', user.id);

            // 3. Get orgs from member rows
            let memberOrgs: Array<{ id: string; name: string; logo_url?: string | null; industry?: string }> = [];
            if (memberOrgIds.length > 0) {
                const { data } = await supabase
                    .from('organizations')
                    .select('id, name, logo_url, industry')
                    .in('id', memberOrgIds);
                memberOrgs = data || [];
            }

            // 4. Merge and deduplicate
            const orgMap = new Map<string, UserOrg>();
            for (const org of (ownedOrgs || [])) {
                orgMap.set(org.id, { id: org.id, name: org.name, role: 'owner', logo_url: org.logo_url, industry: org.industry });
            }
            for (const org of memberOrgs) {
                if (!orgMap.has(org.id)) {
                    // Use actual role from team_members, fallback to 'member' (should verify role string case later)
                    // The DB role might be 'Manager', 'Employee', etc.
                    // We cast to any to satisfy TS or update UserOrg interface to allow string
                    const role = memberRoles.get(org.id) || 'member';
                    // UserOrg interface expects 'owner' | 'member'. We should update interface too or map loosely.
                    // For now, let's cast.
                    orgMap.set(org.id, { id: org.id, name: org.name, role: role as 'owner' | 'member', logo_url: org.logo_url, industry: org.industry });
                }
            }

            const allOrgs = Array.from(orgMap.values());
            setUserOrgs(allOrgs);

            // 5. Determine active org
            const savedOrgId = localStorage.getItem('taskedo-active-org');
            const savedExists = allOrgs.find(o => o.id === savedOrgId);

            if (savedExists) {
                setActiveOrgId(savedExists.id);
                setActiveOrgName(savedExists.name);
            } else if (allOrgs.length > 0) {
                // Fallback: use profile org_id or first org
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('organization_id')
                    .eq('id', user.id)
                    .single();

                const profileOrg = allOrgs.find(o => o.id === profileData?.organization_id);
                const defaultOrg = profileOrg || allOrgs[0];
                setActiveOrgId(defaultOrg.id);
                setActiveOrgName(defaultOrg.name);
                localStorage.setItem('taskedo-active-org', defaultOrg.id);
            } else {
                setActiveOrgId(null);
                setActiveOrgName(null);
            }
        } catch (err) {
            console.error('OrgContext: failed to load orgs', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadOrgs();
    }, [loadOrgs]);

    const switchOrg = useCallback((orgId: string, forceOrg?: UserOrg) => {
        const org = forceOrg || userOrgs.find(o => o.id === orgId);
        if (org) {
            setActiveOrgId(org.id);
            setActiveOrgName(org.name);
            localStorage.setItem('taskedo-active-org', org.id);

            // Update profile.organization_id in background
            supabase.auth.getUser().then(({ data }) => {
                if (data.user) {
                    supabase.from('profiles')
                        .update({ organization_id: org.id, organization: org.name })
                        .eq('id', data.user.id)
                        .then(() => { });
                }
            });
        } else {
            console.error('Org not found in userOrgs:', orgId, userOrgs);
        }
    }, [userOrgs]);

    // Real-time listener for team removals
    useEffect(() => {
        let channel: ReturnType<typeof supabase.channel>;

        const setupSubscription = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            channel = supabase
                .channel('org-membership-changes')
                .on(
                    'postgres_changes',
                    {
                        event: 'DELETE',
                        schema: 'public',
                        table: 'team_members',
                        filter: `user_id=eq.${user.id}`
                    },
                    (_payload) => {
                        // Refresh orgs. loadOrgs() logic will handle default selection if active org is gone.
                        loadOrgs();
                        // Optionally force a refresh of the page or specific UI parts
                    }
                )
                .subscribe();
        };

        setupSubscription();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [loadOrgs]);

    const refreshOrgs = useCallback(async () => {
        setLoading(true);
        await loadOrgs();
    }, [loadOrgs]);

    return (
        <OrgContext.Provider value={{ activeOrgId, activeOrgName, userOrgs, loading, switchOrg, refreshOrgs }}>
            {children}
        </OrgContext.Provider>
    );
}
