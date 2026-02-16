import { supabase } from './supabase';

export interface DbTeamMember {
    id: string;
    user_id: string;
    name: string;
    email: string;
    role: string;
    avatar: string;
    status: 'online' | 'offline' | 'away';
    manager_id: string | null;
    birthday: string | null;
    phone: string | null;
    whatsapp: string | null;
    telegram: string | null;
    organization_id: string;
    created_at: string;
}

export interface DbJoinRequest {
    id: string;
    user_id: string;
    organization_id: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    created_at: string;
    // joined fields
    user_email?: string;
    user_name?: string;
}

export async function fetchTeam(organizationId: string): Promise<DbTeamMember[]> {
    const { data: teamMembers, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true });

    if (error) throw error;
    if (!teamMembers || teamMembers.length === 0) return [];

    // Fetch profiles to get the latest birthday and contact info
    const userIds = teamMembers.map(m => m.user_id).filter(id => id);
    if (userIds.length > 0) {
        try {
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('*') // Be resilient to missing columns
                .in('id', userIds);

            if (profileError) {
                console.error('Database error fetching profiles:', profileError);
            }

            if (profiles && profiles.length > 0) {
                // Merge profile data into team members surgicaly
                return teamMembers.map(member => {
                    const profile = profiles.find(p => p.id === member.user_id);
                    if (!profile) return member;

                    // Create a copy and only patch non-null values from profile
                    const enriched = { ...member };
                    if (profile.display_name) enriched.name = profile.display_name;
                    if (profile.email) enriched.email = profile.email;
                    if (profile.birthday) enriched.birthday = profile.birthday;
                    if (profile.phone) enriched.phone = profile.phone;
                    if (profile.whatsapp) enriched.whatsapp = profile.whatsapp;
                    if (profile.telegram) enriched.telegram = profile.telegram;

                    return enriched;
                });
            }
        } catch (err) {
            console.error('Unexpected error fetching profiles:', err);
            return teamMembers;
        }
    }

    return teamMembers;
}

export async function createMember(member: {
    name: string;
    email: string;
    role: string;
    avatar: string;
    manager_id?: string | null;
    birthday?: string | null;
    organization_id: string;
}): Promise<DbTeamMember> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
        .from('team_members')
        .insert({
            // user_id: user.id, -- REMOVED: New members should only have an ID when they actually sign in
            name: member.name,
            email: member.email,
            role: member.role,
            avatar: member.avatar,
            status: 'offline',
            manager_id: member.manager_id || null,
            birthday: member.birthday || null,
            organization_id: member.organization_id,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateMember(id: string, updates: Partial<Pick<DbTeamMember, 'name' | 'email' | 'role' | 'avatar' | 'status' | 'birthday' | 'manager_id'>>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Not authenticated');
    }

    const { error } = await supabase
        .from('team_members')
        .update(updates)
        .eq('id', id);

    if (error) throw error;
}

export async function removeMember(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Not authenticated');
    }

    const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

export async function ensureUserInTeam(): Promise<DbTeamMember | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    const orgId = profile?.organization_id || user.user_metadata?.organization_id;

    if (!orgId) {
        console.warn('Cannot ensure user in team: No organization_id found');
        return null;
    }

    const displayName = profile?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';

    // 1. Check if member already exists by user_id
    const { data: existingById } = await supabase
        .from('team_members')
        .select('*')
        .eq('user_id', user.id)
        .eq('organization_id', orgId)
        .single();

    if (existingById) {
        // Sync name if it changed in profile
        if (existingById.name !== displayName) {
            await supabase
                .from('team_members')
                .update({ name: displayName })
                .eq('id', existingById.id);
            return { ...existingById, name: displayName };
        }
        return existingById;
    }

    return null;
}

export async function getPendingInvites(): Promise<any[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) return [];

    // Find rows where email matches but user_id is NULL
    const { data, error } = await supabase
        .from('team_members')
        .select(`
            id,
            role,
            created_at,
            organization:organizations (
                id,
                name
            )
        `)
        .eq('email', user.email)
        .is('user_id', null);

    if (error) {
        console.error('Failed to fetch pending invites:', error);
        return [];
    }
    return data || [];
}

export async function acceptInvite(memberId: string, organizationId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';

    // Claim the row
    const { error: claimError } = await supabase
        .from('team_members')
        .update({
            user_id: user.id,
            name: displayName,
            status: 'online',
            avatar: ''
        })
        .eq('id', memberId)
        .eq('email', user.email); // Double check ownership

    if (claimError) throw claimError;

    // Update profile
    await supabase
        .from('profiles')
        .update({ organization_id: organizationId })
        .eq('id', user.id);
}

export async function declineInvite(memberId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) throw new Error('Not authenticated');

    // Delete the pending invite logic
    // We match by ID and EMAIL to ensure user owns this invite
    const { error, count } = await supabase
        .from('team_members')
        .delete({ count: 'exact' })
        .eq('id', memberId)
        .eq('email', user.email)
        .is('user_id', null);

    if (error) throw error;
    if (count === 0) {
        throw new Error('Invitation not found or already processed');
    }
}

export async function joinOrganization(inviteCode: string): Promise<any> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('invite_code', inviteCode.toUpperCase())
        .single();

    if (orgError || !org) throw new Error('Invalid invite code');

    // STRICT MODE: Check for existing placeholder by email
    // User MUST be invited by email to join
    if (user.email) {
        const { data: existingByEmail } = await supabase
            .from('team_members')
            .select('*')
            .eq('email', user.email)
            .eq('organization_id', org.id)
            .is('user_id', null)
            .single();

        if (existingByEmail) {
            // Claim it
            const { data: claimed, error: claimError } = await supabase
                .from('team_members')
                .update({
                    user_id: user.id,
                    name: user.user_metadata?.full_name || user.email?.split('@')[0],
                    status: 'online'
                })
                .eq('id', existingByEmail.id)
                .select()
                .single();

            if (claimError) throw claimError;

            // Update profile
            await supabase
                .from('profiles')
                .update({ organization_id: org.id })
                .eq('id', user.id);

            return claimed;
        }
    }

    // If we get here, it means the user was NOT found in the allowlist
    throw new Error('Access Denied: You must be invited by email to join this organization.');
}

// ============================================================================
// JOIN REQUESTS (New Implementation)
// ============================================================================

export async function createJoinRequest(organizationId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check if already requested (RLS might also block, but good to check)
    const { data: existing } = await supabase
        .from('join_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .in('status', ['pending', 'approved'])
        .maybeSingle();

    if (existing) {
        if (existing.status === 'approved') throw new Error('You have already joined this organization.');
        throw new Error('Request already sent.');
    }

    const { error } = await supabase
        .from('join_requests')
        .insert({
            user_id: user.id,
            organization_id: organizationId,
            status: 'pending'
        });

    if (error) {
        // Handle unique constraint violation gracefully
        if (error.code === '23505') throw new Error('Request already sent.');
        throw error;
    }
}

export async function fetchJoinRequests(organizationId: string): Promise<DbJoinRequest[]> {
    const { data, error } = await supabase
        .from('join_requests')
        .select(`
            *,
            profiles!user_id (
                id,
                email,
                display_name
            )
        `)
        .eq('organization_id', organizationId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching join requests:', error);
        return [];
    }

    return (data || []).map(req => {
        const profile = (req as any).profiles;
        return {
            ...req,
            user_name: profile?.display_name,
            user_email: profile?.email
        };
    });
}

export async function respondToJoinRequest(requestId: string, status: 'approved' | 'rejected'): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    if (status === 'rejected') {
        const { error } = await supabase
            .from('join_requests')
            .update({ status: 'rejected' })
            .eq('id', requestId);
        if (error) throw error;
        return;
    }

    if (status === 'approved') {
        // Transaction-like approach needed
        // 1. Get request details
        const { data: req, error: getError } = await supabase
            .from('join_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (getError || !req) throw new Error('Request not found');

        // 2. Fetch profile to get details for team member
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', req.user_id)
            .single();

        const name = profile?.display_name || 'New Member';
        const email = profile?.email || '';

        // 3. Find Organization Owner to set as manager
        let managerId = null;

        // Get org owner_id
        const { data: org } = await supabase
            .from('organizations')
            .select('owner_id')
            .eq('id', req.organization_id)
            .single();

        if (org) {
            // Get owner's team_member id
            const { data: ownerMember } = await supabase
                .from('team_members')
                .select('id')
                .eq('organization_id', req.organization_id)
                .eq('user_id', org.owner_id)
                .single();

            if (ownerMember) {
                managerId = ownerMember.id;
            }
        }

        // 4. Add to team members
        const { error: teamError } = await supabase
            .from('team_members')
            .insert({
                user_id: req.user_id,
                organization_id: req.organization_id,
                name: name,
                email: email,
                role: 'Employee',
                status: 'offline',
                manager_id: managerId
            });

        if (teamError) throw teamError;

        // 5. Update request status
        await supabase
            .from('join_requests')
            .update({ status: 'approved' })
            .eq('id', requestId);

        // 6. Update user's profile to point to this org (optional, but helpful for auto-switch)
        await supabase
            .from('profiles')
            .update({ organization_id: req.organization_id })
            .eq('id', req.user_id);
    }
}

export async function ensureOwnerMember(organizationId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Get organization owner
    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('owner_id')
        .eq('id', organizationId)
        .single();

    if (orgError || !org) return;

    // 2. Check existing members for this owner
    const { data: existingMembers, error: fetchError } = await supabase
        .from('team_members')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('user_id', org.owner_id)
        .order('created_at', { ascending: true });

    if (fetchError) return;

    if (existingMembers && existingMembers.length > 0) {
        // Force sync owner data if missing or different
        const owner = existingMembers[0];
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', org.owner_id).single();
        const expectedName = profile?.display_name || user.user_metadata?.full_name || 'Owner';
        const expectedEmail = profile?.email || user.email || '';

        if (owner.name !== expectedName || owner.email !== expectedEmail) {
            await supabase.from('team_members').update({ name: expectedName, email: expectedEmail }).eq('id', owner.id);
        }

        if (existingMembers.length > 1) {
            const [, ...duplicates] = existingMembers;
            const idsToDelete = duplicates.map(m => m.id);
            if (idsToDelete.length > 0) {
                await supabase.from('team_members').delete().in('id', idsToDelete);
            }
        }
        return;
    }



    // 3. If missing, add them
    // We need their profile info first
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', org.owner_id)
        .single();

    const name = profile?.display_name || user.user_metadata?.full_name || 'Owner';
    const email = profile?.email || user.email || '';

    await supabase
        .from('team_members')
        .insert({
            user_id: org.owner_id,
            organization_id: organizationId,
            name: name,
            email: email,
            role: 'owner',
            status: 'online',
            manager_id: null // Top of hierarchy
        });
}
