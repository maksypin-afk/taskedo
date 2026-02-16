import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrg } from '../../lib/OrgContext';
import { CustomSelect } from '../../components/CustomSelect';
import { supabase } from '../../lib/supabase';
import { updateProfile } from '../../lib/profileService';
import { createOrganization } from '../../lib/organizationService';
import {
    createMember, ensureUserInTeam, fetchJoinRequests, respondToJoinRequest, updateMember, removeMember, ensureOwnerMember, fetchTeam,
    type DbJoinRequest
} from '../../lib/teamService';
import { getInitials } from '../../lib/utils';
import { OrgChart } from '../../components/OrgChart';

interface TeamMember {
    id: string;
    user_id: string | null;
    name: string;
    email: string;
    role: string;
    avatar: string;
    status: string;
    manager_id: string | null;
    birthday: string | null;
    phone: string | null;
    whatsapp: string | null;
    telegram: string | null;
    organization_id: string;
    created_at: string;
}

type TeamView = 'loading' | 'choose' | 'create' | 'join' | 'team';

const INDUSTRIES = [
    { value: '', labelKey: 'dashboard.team.selectIndustry' },
    { value: 'it', labelKey: 'dashboard.team.industryIT' },
    { value: 'marketing', labelKey: 'dashboard.team.industryMarketing' },
    { value: 'education', labelKey: 'dashboard.team.industryEducation' },
    { value: 'finance', labelKey: 'dashboard.team.industryFinance' },
    { value: 'sales', labelKey: 'dashboard.team.industrySales' },
    { value: 'construction', labelKey: 'dashboard.team.industryConstruction' },
    { value: 'horeca', labelKey: 'dashboard.team.industryHoReCa' },
    { value: 'healthcare', labelKey: 'dashboard.team.industryHealthcare' },
    { value: 'logistics', labelKey: 'dashboard.team.industryLogistics' },
    { value: 'family', labelKey: 'dashboard.team.industryFamily' },
    { value: 'other', labelKey: 'dashboard.team.industryOther' },
];


// Helper to check for circular dependencies
const wouldCreateCycle = (team: TeamMember[], targetId: string, newManagerId: string | null): boolean => {
    if (!newManagerId) return false;
    if (newManagerId === targetId) return true;

    let currentId: string | null = newManagerId;
    while (currentId) {
        const manager = team.find(m => m.id === currentId);
        if (!manager) break; // Should not happen if integrity is maintained
        if (manager.manager_id === targetId) return true;
        currentId = manager.manager_id;
    }
    return false;
};

// Tree Item Component
const MemberTreeItem = ({
    member,
    team,
    onEdit,
    onDelete,
    onMemberClick,
    depth = 0,
    canManage
}: {
    member: TeamMember;
    team: TeamMember[];
    onEdit: (m: TeamMember) => void;
    onDelete: (id: string) => void;
    onMemberClick?: (m: TeamMember) => void;
    depth?: number;
    canManage: boolean;
}) => {
    const subordinates = team.filter(m => m.manager_id === member.id);
    const hasSubordinates = subordinates.length > 0;
    const [expanded, setExpanded] = useState(true);

    return (
        <div style={{ marginLeft: depth > 0 ? '2rem' : 0, position: 'relative' }}>
            {depth > 0 && (
                <div style={{
                    position: 'absolute', left: '-1rem', top: '1.2rem', width: '1rem', height: '1px',
                    background: 'var(--color-border)'
                }} />
            )}
            {depth > 0 && (
                <div style={{
                    position: 'absolute', left: '-1rem', top: '-0.5rem', bottom: '1.2rem', width: '1px',
                    background: 'var(--color-border)'
                }} />
            )}

            <div
                className="glass-card"
                onClick={() => onMemberClick?.(member)}
                style={{
                    padding: '0.75rem 1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem',
                    borderLeft: member.role === 'owner' ? '3px solid var(--color-primary)' : '1px solid var(--color-border)',
                    cursor: onMemberClick ? 'pointer' : 'default'
                }}
            >
                {hasSubordinates && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem',
                            width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--color-text-muted)'
                        }}
                    >
                        {expanded ? '▼' : '▶'}
                    </button>
                )}
                {!hasSubordinates && <div style={{ width: '20px' }} />}

                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-text)', flexShrink: 0 }}>
                    {getInitials(member.name)}
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        {member.name}
                        {member.id === member.user_id && <span style={{ fontSize: '0.7rem', opacity: 0.5, marginLeft: '0.5rem' }}>(You)</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{member.role}</div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {canManage && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(member); }}
                                style={{ padding: '4px 8px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: 'var(--radius-md)', color: '#8b5cf6', cursor: 'pointer', fontSize: '0.75rem' }}
                            >
                                ✎
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(member.id); }}
                                style={{ padding: '4px 8px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--radius-md)', color: '#f87171', cursor: 'pointer', fontSize: '0.75rem' }}
                            >
                                ✕
                            </button>
                        </>
                    )}
                </div>
            </div>

            {expanded && hasSubordinates && (
                <div style={{ position: 'relative' }}>
                    {/* Connector line for children */}
                    {subordinates.length > 1 && (
                        <div style={{
                            position: 'absolute', left: '1rem', top: 0, bottom: '1.5rem', width: '1px',
                            background: 'var(--color-border)'
                        }} />
                    )}
                    {subordinates.map(sub => (
                        <MemberTreeItem
                            key={sub.id}
                            member={sub}
                            team={team}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onMemberClick={onMemberClick}
                            depth={depth + 1}
                            canManage={canManage}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default function TeamPage() {
    const { t } = useTranslation();
    const { activeOrgId, switchOrg, refreshOrgs, userOrgs } = useOrg();

    const currentOrg = userOrgs.find(o => o.id === activeOrgId);
    // Role handling: 'owner' is usually from org creation. 'Manager'/'Employee' from team_members.
    // We normalize to lowercase for comparison.
    const userRole = currentOrg?.role?.toLowerCase();
    const canManageTeam = userRole === 'owner' || userRole === 'manager';

    const [view, setView] = useState<TeamView>('loading');
    const [displayMode, setDisplayMode] = useState<'list' | 'tree'>('list'); // New state
    const [team, setTeam] = useState<TeamMember[]>([]);
    // Removed local organizationId state as we use activeOrgId from context
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isPersonal, setIsPersonal] = useState(false);

    // Join Requests (Admin view)
    const [joinRequests, setJoinRequests] = useState<DbJoinRequest[]>([]);

    // Create org form
    const [orgName, setOrgName] = useState('');
    const [orgDescription, setOrgDescription] = useState('');
    const [orgIndustry, setOrgIndustry] = useState('');
    const [orgLogo, setOrgLogo] = useState<File | null>(null);
    const [orgLogoPreview, setOrgLogoPreview] = useState<string | null>(null);
    const [fetchingData, setFetchingData] = useState(true);


    // Add member form
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState('');

    // Edit member
    const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState('');
    const [editManagerId, setEditManagerId] = useState<string | null>(null);

    // Profile detail modal
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

    useEffect(() => {
        if (editingMember) {
            setEditName(editingMember.name || '');
            setEditRole(editingMember.role || '');
            setEditManagerId(editingMember.manager_id || null);
        }
    }, [editingMember]);

    const handleUpdateMember = async () => {
        if (!editingMember) return;

        // Cyclic check
        if (wouldCreateCycle(team, editingMember.id, editManagerId)) {
            alert(t('dashboard.team.circularDependencyError') || 'Cannot set reporting line: circular dependency detected.');
            return;
        }

        try {
            const { error } = await supabase
                .from('team_members')
                .update({
                    role: editRole,
                    manager_id: editManagerId
                })
                .eq('id', editingMember.id);
            if (error) throw error;
            setEditingMember(null);
            loadTeam();
        } catch (err: any) {
            alert(err.message);
        }
    };

    // Load team when in team view
    const loadTeam = useCallback(async () => {
        if (!activeOrgId) return;
        try {
            // Ensure owner is always in the list
            await ensureOwnerMember(activeOrgId);

            const data = await fetchTeam(activeOrgId);

            // Deduplicate by user_id to prevent UI glitches if DB has duplicates
            const uniqueTeam: TeamMember[] = [];
            const seenUsers = new Set();
            (data || []).forEach(m => {
                const member = m as unknown as TeamMember;
                if (member.user_id) {
                    if (!seenUsers.has(member.user_id)) {
                        seenUsers.add(member.user_id);
                        uniqueTeam.push(member);
                    }
                } else {
                    uniqueTeam.push(member);
                }
            });

            setTeam(uniqueTeam);

            // Fetch industry
            const { data: orgData } = await supabase
                .from('organizations')
                .select('industry')
                .eq('id', activeOrgId)
                .single();
            if (orgData) {
                setIsPersonal(orgData.industry === 'Personal');
            }

            // Fetch join requests if admin
            // We check role again or let the service fail/return empty if RLS blocks
            if (canManageTeam) {
                const reqs = await fetchJoinRequests(activeOrgId);
                setJoinRequests(reqs);
            }

        } catch (err) {
            console.error(err);
        } finally {
            setFetchingData(false);
        }
    }, [activeOrgId, canManageTeam]);

    // Enforce hierarchy: Non-owners without manager should report to Owner
    useEffect(() => {
        if (!team.length || !canManageTeam) return;

        const enforceHierarchy = async () => {
            const owner = team.find(m => m.role.toLowerCase() === 'owner');
            if (!owner) return;

            const orphans = team.filter(m =>
                m.id !== owner.id && // Not the owner
                !m.manager_id && // No manager
                m.role.toLowerCase() !== 'owner' // Double check role
            );

            if (orphans.length > 0) {
                await Promise.all(orphans.map(orphan =>
                    updateMember(orphan.id, { manager_id: owner.id })
                ));
                loadTeam(); // Refresh to show changes
            }
        };

        enforceHierarchy();
    }, [team, canManageTeam, loadTeam]);

    // Initialize view and load data based on activeOrgId
    useEffect(() => {
        if (activeOrgId) {
            setFetchingData(true);
            setView('team');
            loadTeam();
        } else {
            setFetchingData(false);
            setView('choose');
        }
    }, [activeOrgId, loadTeam]);

    // Handle creating a new organization
    const handleCreateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgName.trim()) return;
        setLoading(true);
        setError('');

        try {
            let logoUrl: string | undefined;

            // Upload logo if provided
            if (orgLogo) {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('Not authenticated');

                const fileExt = orgLogo.name.split('.').pop();
                const filePath = `org-logos/${user.id}-${Date.now()}.${fileExt}`;
                const { error: uploadErr } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, orgLogo);
                if (uploadErr) throw uploadErr;

                const { data: { publicUrl } } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);
                logoUrl = publicUrl;
            }

            const org = await createOrganization({
                name: orgName.trim(),
                description: orgDescription.trim() || undefined,
                industry: orgIndustry || undefined,
                logo_url: logoUrl,
            });

            // Update profile with organization
            await updateProfile({
                organization: org.name,
            });

            // Also update organization_id in profile directly
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase
                    .from('profiles')
                    .update({ organization_id: org.id })
                    .eq('id', user.id);
            }

            // Ensure user is in team
            await ensureUserInTeam();

            // Also add the creator as a team member with Manager role
            if (user) {
                const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Manager';

                // Add member explicitly
                await supabase
                    .from('team_members')
                    .insert({
                        user_id: user.id,
                        name: displayName,
                        email: user.email || '',
                        role: 'Manager',
                        status: 'online',
                        organization: org.name,
                        organization_id: org.id,
                    });
            }

            // Refresh orgs context and switch to new org
            await refreshOrgs();

            // Pass the org object explicitly to avoid stale closure issues with userOrgs
            switchOrg(org.id, {
                id: org.id,
                name: org.name,
                role: 'owner',
                logo_url: org.logo_url
            });

            setView('team');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // Handle logo file selection
    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setOrgLogo(file);
            const reader = new FileReader();
            reader.onloadend = () => setOrgLogoPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };



    const handleRespondToRequest = async (requestId: string, status: 'approved' | 'rejected') => {
        try {
            await respondToJoinRequest(requestId, status);
            // Reload requests
            if (activeOrgId) {
                const reqs = await fetchJoinRequests(activeOrgId);
                setJoinRequests(reqs);
                // If approved, also reload team
                if (status === 'approved') loadTeam();
            }
        } catch (err: any) {
            alert(err.message);
        }
    };

    // Handle adding member
    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isPersonal) return; // double check
        if (!newEmail.trim() || !activeOrgId) return;

        // Check if user already exists in team
        if (team.some(m => m.email?.toLowerCase() === newEmail.trim().toLowerCase())) {
            alert(t('dashboard.team.memberExists') || 'User with this email is already in the team');
            return;
        }

        setLoading(true);
        try {
            // Find owner id for default manager
            const owner = team.find(m => m.role === 'owner');

            await createMember({
                name: newEmail.split('@')[0], // Temporary name until they update profile
                email: newEmail.trim(),
                role: newRole.trim() || 'Employee',
                avatar: '', // Default avatar handled by UI/backend
                organization_id: activeOrgId,
                manager_id: owner?.id || null // Auto-assign to owner
            });
            // setNewName(''); // Name is no longer used
            setNewEmail('');
            setNewRole('');
            await loadTeam();
        } catch (err: any) {
            console.error(err);
            alert(`Failed to invite: ${err.message || 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    // Handle deleting a member
    const handleDelete = async (id: string) => {
        const member = team.find(m => m.id === id);
        if (member?.role === 'owner') {
            alert('Cannot delete the organization owner');
            return;
        }
        if (!window.confirm('Are you sure you want to remove this member?')) return;
        try {
            await removeMember(id);
            await loadTeam();
        } catch (err) {
            console.error(err);
        }
    };

    // Get manager name for display
    const getManagerName = (managerId: string | null) => {
        if (!managerId) return t('dashboard.team.noManager');
        const manager = team.find(m => m.id === managerId);
        return manager?.name || '—';
    };

    // ===== RENDER: LOADING =====
    if (view === 'loading' || fetchingData) {
        return <div className="kanban-loading">{t('auth.loading')}</div>;
    }

    // ===== RENDER: CHOOSE =====
    if (view === 'choose') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '2rem' }}>
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
                        {t('dashboard.team.noTeamTitle')}
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem' }}>
                        {t('dashboard.team.noTeamSubtitle')}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {/* Create Team Card */}
                    <button
                        onClick={() => { setView('create'); setError(''); }}
                        style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                            padding: '2.5rem 3rem', background: 'rgba(99, 102, 241, 0.06)',
                            border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 'var(--radius-xl)',
                            cursor: 'pointer', transition: 'all 0.2s ease', minWidth: '220px',
                            color: 'var(--color-text)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)'; e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)'; e.currentTarget.style.background = 'rgba(99, 102, 241, 0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        <span style={{ fontSize: '2.5rem' }}>🏢</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{t('dashboard.team.createTeam')}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                            {t('dashboard.team.createTeamDesc')}
                        </span>
                    </button>

                    {/* Join Team Card */}
                    <button
                        onClick={() => { setView('join'); setError(''); }}
                        style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                            padding: '2.5rem 3rem', background: 'rgba(52, 211, 153, 0.06)',
                            border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: 'var(--radius-xl)',
                            cursor: 'pointer', transition: 'all 0.2s ease', minWidth: '220px',
                            color: 'var(--color-text)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(52, 211, 153, 0.5)'; e.currentTarget.style.background = 'rgba(52, 211, 153, 0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(52, 211, 153, 0.2)'; e.currentTarget.style.background = 'rgba(52, 211, 153, 0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        <span style={{ fontSize: '2.5rem' }}>🤝</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{t('dashboard.team.joinTeam')}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                            {t('dashboard.team.joinTeamDesc')}
                        </span>
                    </button>
                </div>
            </div>
        );
    }

    // ===== RENDER: CREATE ORG =====
    if (view === 'create') {
        return (
            <div style={{ maxWidth: '520px', margin: '0 auto' }}>
                <button
                    onClick={() => {
                        if (activeOrgId) setView('team');
                        else setView('choose');
                        setError('');
                    }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)',
                        background: 'none', border: 'none', cursor: 'pointer', marginBottom: '1.5rem',
                        fontSize: '0.9rem', fontWeight: 500,
                    }}
                >
                    ← {t('dashboard.team.back')}
                </button>

                <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                    <div>
                        <h1>{t('dashboard.team.createTeam')}</h1>
                        <p>{t('dashboard.team.createTeamFormDesc')}</p>
                    </div>
                </div>

                {error && (
                    <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>
                )}

                <form onSubmit={handleCreateOrg} className="glass-card" style={{ padding: 'var(--spacing-xl)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Org Name */}
                    <div className="form-group">
                        <label htmlFor="orgName" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                            {t('dashboard.team.orgName')} *
                        </label>
                        <div className="input-wrapper">
                            <input
                                id="orgName"
                                type="text"
                                value={orgName}
                                onChange={e => setOrgName(e.target.value)}
                                placeholder={t('dashboard.team.orgNamePlaceholder')}
                                required
                                style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text)', fontSize: '0.95rem' }}
                            />
                        </div>
                    </div>

                    {/* Logo Upload */}
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                            {t('dashboard.team.orgLogo')}
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {orgLogoPreview ? (
                                <img src={orgLogoPreview} alt="Logo" style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-lg)', objectFit: 'contain', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)' }} />
                            ) : (
                                <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-lg)', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', border: '1px dashed var(--color-border)' }}>
                                    🏢
                                </div>
                            )}
                            <label style={{ cursor: 'pointer', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                                {t('profile.changeAvatar')}
                                <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
                            </label>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="form-group">
                        <label htmlFor="orgDesc" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                            {t('dashboard.team.orgDescription')}
                        </label>
                        <textarea
                            id="orgDesc"
                            value={orgDescription}
                            onChange={e => setOrgDescription(e.target.value)}
                            placeholder={t('dashboard.team.orgDescriptionPlaceholder')}
                            rows={3}
                            style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text)', fontSize: '0.95rem', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                    </div>

                    {/* Industry */}
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                            {t('dashboard.team.orgIndustry')}
                        </label>
                        <CustomSelect
                            value={orgIndustry}
                            onChange={(val) => setOrgIndustry(val)}
                            options={INDUSTRIES
                                .filter(i => i.value !== '')
                                .map(ind => ({
                                    value: ind.value,
                                    label: t(ind.labelKey)
                                }))}
                            placeholder={t('dashboard.team.selectIndustry')}
                            className="org-industry-select"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        disabled={loading || !orgName.trim()}
                        style={{ width: '100%', marginTop: '0.5rem' }}
                    >
                        {loading ? t('auth.loading') : t('dashboard.team.createTeam')}
                    </button>
                </form>
            </div>
        );
    }

    // ===== RENDER: JOIN ORG =====
    if (view === 'join') {
        return (
            <div style={{ maxWidth: '520px', margin: '0 auto' }}>
                <button
                    onClick={() => {
                        if (activeOrgId) setView('team');
                        else setView('choose');
                        setError('');
                        setSuccessMsg('');
                    }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)',
                        background: 'none', border: 'none', cursor: 'pointer', marginBottom: '1.5rem',
                        fontSize: '0.9rem', fontWeight: 500,
                    }}
                >
                    ← {t('dashboard.team.back')}
                </button>

                <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                    <div>
                        <h1>{t('dashboard.team.joinTeam')}</h1>
                        <p>{t('dashboard.team.joinTeamFormDesc')}</p>
                    </div>
                </div>

                {
                    error && (
                        <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>
                    )
                }
                {
                    successMsg && (
                        <div style={{ padding: '1rem', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: 'var(--radius-md)', color: '#34d399', marginBottom: '1rem' }}>
                            {successMsg}
                        </div>
                    )
                }

                <div className="glass-card" style={{ padding: 'var(--spacing-xl)', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
                    <h3 style={{ marginBottom: '0.5rem' }}>{t('dashboard.team.inviteOnly') || 'Invite Only'}</h3>
                    <p style={{ color: 'var(--color-text-muted)' }}>
                        {t('dashboard.team.inviteOnlyDesc') || 'Please ask your administrator for an invite link to join an organization.'}
                    </p>
                </div>
            </div >
        );
    }

    // ===== RENDER: TEAM LIST =====


    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>{t('dashboard.team.title')}</h1>
                    <p>{t('dashboard.team.subtitle')}</p>
                </div>
                {!isPersonal && (
                    <div className="glass-toggle" style={{ display: 'flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-lg)' }}>
                        <button
                            onClick={() => setDisplayMode('list')}
                            className={displayMode === 'list' ? 'active' : ''}
                            style={{
                                padding: '6px 12px', border: 'none', borderRadius: 'var(--radius-md)',
                                background: displayMode === 'list' ? 'var(--color-primary)' : 'transparent',
                                color: displayMode === 'list' ? 'white' : 'var(--color-text-muted)',
                                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.2s'
                            }}
                        >
                            {t('dashboard.team.list')}
                        </button>
                        <button
                            onClick={() => setDisplayMode('tree')}
                            className={displayMode === 'tree' ? 'active' : ''}
                            style={{
                                padding: '6px 12px', border: 'none', borderRadius: 'var(--radius-md)',
                                background: displayMode === 'tree' ? 'var(--color-primary)' : 'transparent',
                                color: displayMode === 'tree' ? 'white' : 'var(--color-text-muted)',
                                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.2s'
                            }}
                        >
                            {t('dashboard.team.structure')}
                        </button>
                    </div>
                )}
            </div>

            {/* PENDING REQUESTS (Admin Only) */}
            {canManageTeam && joinRequests.length > 0 && (
                <div className="glass-card animate-fade-in-up" style={{ marginBottom: '2rem', border: '1px solid rgba(251, 191, 36, 0.3)', background: 'rgba(251, 191, 36, 0.05)' }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid rgba(251, 191, 36, 0.2)' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fbbf24' }}>Pending Join Requests</h3>
                    </div>
                    <div>
                        {joinRequests.map(req => (
                            <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{req.user_name || req.user_email || 'Unknown User'}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{req.user_email}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => handleRespondToRequest(req.id, 'approved')}
                                        className="btn btn-primary btn-sm"
                                        style={{ background: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleRespondToRequest(req.id, 'rejected')}
                                        className="btn btn-sm"
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)' }}
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isPersonal ? (
                <div className="glass-card animate-fade-in-up" style={{ textAlign: 'center', padding: '3rem 1rem', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
                    <h3>{t('dashboard.team.personalWorkspace')}</h3>
                    <p style={{ color: 'var(--color-text-muted)', maxWidth: '500px', margin: '1rem auto' }}>
                        {t('dashboard.team.personalDesc')}
                    </p>
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            setView('create');
                            setError('');
                        }}
                    >
                        {t('dashboard.team.createTeam')}
                    </button>
                </div>
            ) : (
                <>
                    {/* Add member form */}
                    <form
                        onSubmit={handleAdd}
                        className="glass-card"
                        style={{ padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-xl)', display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', alignItems: 'flex-end' }}
                    >

                        <div style={{ flex: '1 1 200px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px', display: 'block' }}>Email</label>
                            <input
                                value={newEmail}
                                onChange={e => setNewEmail(e.target.value)}
                                placeholder="email@example.com"
                                type="email"
                                className="glass-input"
                            />
                        </div>
                        <div style={{ flex: '1 1 160px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px', display: 'block' }}>{t('dashboard.team.role')}</label>
                            <input
                                value={newRole}
                                onChange={e => setNewRole(e.target.value)}
                                placeholder={t('dashboard.team.rolePlaceholder')}
                                className="glass-input"
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading || !newEmail.trim()}
                            style={{ padding: '0.6rem 1.5rem', whiteSpace: 'nowrap' }}
                        >
                            {t('dashboard.team.invite')}
                        </button>
                    </form>

                    {/* TREE VIEW */}
                    {displayMode === 'tree' && (
                        <div className="animate-fade-in-up">
                            {team.length === 0 ? (
                                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌳</div>
                                    <h3>{t('dashboard.team.emptyState.title')}</h3>
                                    <p style={{ color: 'var(--color-text-muted)' }}>{t('dashboard.team.emptyState.desc')}</p>

                                </div>
                            ) : (
                                <OrgChart
                                    team={team}
                                    onEdit={setEditingMember}
                                    onDelete={handleDelete}
                                    onMemberClick={setSelectedMember}
                                    canManage={canManageTeam}
                                />
                            )}
                        </div>
                    )}

                    {/* LIST VIEW */}
                    {displayMode === 'list' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            {team.map(member => (
                                <div
                                    key={member.id}
                                    className="glass-card"
                                    onClick={() => setSelectedMember(member)}
                                    style={{ padding: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', cursor: 'pointer' }}
                                >
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '50%',
                                        background: member.role === 'owner' ? 'linear-gradient(135deg, var(--color-accent), #8b5cf6)' : 'rgba(255,255,255,0.06)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 700, color: 'white', fontSize: '0.85rem', flexShrink: 0
                                    }}>
                                        {getInitials(member.name)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>{member.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span>{member.role === 'owner' ? t('dashboard.team.role_owner') : member.role}</span>
                                            {member.manager_id && (
                                                <>
                                                    <span style={{ opacity: 0.3 }}>•</span>
                                                    <span>{t('dashboard.team.reportsTo')}: {getManagerName(member.manager_id)}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
                                        {canManageTeam && (
                                            <>
                                                <button
                                                    onClick={() => setEditingMember(member)}
                                                    style={{ padding: '4px 8px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: 'var(--radius-md)', color: '#8b5cf6', cursor: 'pointer', fontSize: '0.75rem' }}
                                                >
                                                    {t('dashboard.team.edit')}
                                                </button>
                                                {member.role !== 'owner' && (
                                                    <button
                                                        onClick={() => handleDelete(member.id)}
                                                        style={{ padding: '4px 8px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--radius-md)', color: '#f87171', cursor: 'pointer', fontSize: '0.75rem' }}
                                                    >
                                                        {t('dashboard.team.delete')}
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Edit Member Modal */}
            {editingMember && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="glass-card animate-fade-in-up" style={{ padding: '2rem', width: '400px', maxWidth: '90%', background: '#1e1e2e', border: '1px solid var(--color-border)' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>{t('dashboard.team.editMember')}</h3>
                        <div style={{ margin: '1rem 0' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>{t('dashboard.team.namePlaceholder')}</label>
                            <input
                                className="glass-input"
                                value={editName}
                                readOnly
                                style={{ width: '100%', opacity: 0.7, cursor: 'not-allowed', background: 'rgba(255,255,255,0.05)' }}
                            />
                        </div>
                        <div style={{ margin: '1rem 0' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>{t('dashboard.team.role')}</label>
                            <input
                                className="glass-input"
                                value={editRole}
                                onChange={e => setEditRole(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div style={{ margin: '1rem 0' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>{t('dashboard.team.reportsTo')}</label>
                            <CustomSelect
                                value={editManagerId || ''}
                                onChange={(val) => setEditManagerId(val || null)}
                                options={[
                                    { value: '', label: t('dashboard.team.noManager') },
                                    ...team
                                        .filter(m => m.id !== editingMember.id)
                                        .map(m => ({
                                            value: m.id,
                                            label: `${m.name} (${m.role})`
                                        }))
                                ]}
                                placeholder={t('dashboard.team.selectManager')}
                                className="glass-input"
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                            <button className="btn btn-outline" onClick={() => setEditingMember(null)}>{t('dashboard.team.cancel')}</button>
                            <button className="btn btn-primary" onClick={handleUpdateMember}>{t('dashboard.team.save')}</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Member Profile Modal */}
            {selectedMember && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
                    onClick={() => setSelectedMember(null)}
                >
                    <div
                        className="glass-card animate-fade-in-up"
                        style={{ padding: '2.5rem', width: '450px', maxWidth: '90%', background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedMember(null)}
                            style={{ position: 'absolute', top: '1.25rem', right: '1.5rem', background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--color-text-muted)', cursor: 'pointer', transition: 'color 0.2s' }}
                        >✕</button>

                        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                            <div style={{
                                width: '100px', height: '100px', borderRadius: '50%', margin: '0 auto 1.5rem',
                                background: selectedMember.role === 'owner' ? 'linear-gradient(135deg, var(--color-accent), #8b5cf6)' : 'rgba(255,255,255,0.06)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, color: 'white', fontSize: '2.2rem', border: '4px solid rgba(255,255,255,0.1)',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)'
                            }}>
                                {getInitials(selectedMember.name)}
                            </div>
                            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.75rem', letterSpacing: '-0.02em' }}>{selectedMember.name}</h2>
                            <div style={{
                                background: 'rgba(139, 92, 246, 0.1)',
                                color: '#8b5cf6',
                                padding: '4px 12px',
                                borderRadius: '20px',
                                display: 'inline-block',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                border: '1px solid rgba(139, 92, 246, 0.2)'
                            }}>
                                {selectedMember.role === 'owner' ? t('dashboard.team.role_owner') : selectedMember.role}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Email */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📧</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Email</div>
                                    {selectedMember.email ? (
                                        <a href={`mailto:${selectedMember.email}`} style={{ color: 'var(--color-text)', textDecoration: 'none', fontWeight: 500 }}>
                                            {selectedMember.email}
                                        </a>
                                    ) : <div style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>—</div>}
                                </div>
                            </div>

                            {/* Birthday */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🎂</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{t('profile.birthday')}</div>
                                    <div style={{ fontWeight: 500, color: selectedMember.birthday ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{selectedMember.birthday || '—'}</div>
                                </div>
                            </div>

                            {/* Phone */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📞</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{t('profile.phone')}</div>
                                    {selectedMember.phone ? (
                                        <a href={`tel:${selectedMember.phone}`} style={{ color: 'var(--color-text)', textDecoration: 'none', fontWeight: 500 }}>
                                            {selectedMember.phone}
                                        </a>
                                    ) : <div style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>—</div>}
                                </div>
                            </div>

                            {/* Messenger Links */}
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                {selectedMember.whatsapp && (
                                    <a
                                        href={selectedMember.whatsapp.startsWith('http') ? selectedMember.whatsapp : `https://wa.me/${selectedMember.whatsapp.replace(/\D/g, '')}`}
                                        target="_blank" rel="noopener noreferrer"
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1rem', background: 'rgba(37, 211, 102, 0.1)', border: '1px solid rgba(37, 211, 102, 0.2)', borderRadius: '16px', color: '#25d366', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s' }}
                                    >
                                        WhatsApp
                                    </a>
                                )}
                                {selectedMember.telegram && (
                                    <a
                                        href={selectedMember.telegram.startsWith('http') ? selectedMember.telegram : `https://t.me/${selectedMember.telegram.replace('@', '').trim()}`}
                                        target="_blank" rel="noopener noreferrer"
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1rem', background: 'rgba(0, 136, 204, 0.1)', border: '1px solid rgba(0, 136, 204, 0.2)', borderRadius: '16px', color: '#0088cc', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s' }}
                                    >
                                        Telegram
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
