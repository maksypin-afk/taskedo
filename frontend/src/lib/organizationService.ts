import { supabase } from './supabase';

export interface DbOrganization {
    id: string;
    name: string;
    invite_code: string;
    owner_id: string;
    description?: string;
    industry?: string;
    logo_url?: string;
    created_at: string;
}

export async function createOrganization(options: {
    name: string;
    description?: string;
    industry?: string;
    logo_url?: string;
}): Promise<DbOrganization> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Generate a simple 6-char invite code
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data, error } = await supabase
        .from('organizations')
        .insert({
            name: options.name,
            invite_code: inviteCode,
            owner_id: user.id,
            description: options.description || null,
            industry: options.industry || null,
            logo_url: options.logo_url || null,
        })
        .select()
        .single();

    if (error) throw error;

    // Auto-add owner to team_members
    const { error: memberError } = await supabase
        .from('team_members')
        .insert({
            user_id: user.id,
            organization_id: data.id,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Owner',
            email: user.email || '',
            role: 'owner',
            status: 'online',
            avatar: user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user.email}&background=random`
        });

    if (memberError) {
        console.error('Failed to add owner to team:', memberError);
        // We don't throw here to avoid breaking the org creation, but it's a critical failure for consistency
    }

    return data;
}

export async function fetchOrganizationByCode(code: string): Promise<DbOrganization | null> {
    const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('invite_code', code.toUpperCase())
        .single();

    if (error) return null;
    return data;
}

export async function fetchOrganizationById(id: string): Promise<DbOrganization | null> {
    const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .single();

    if (error) return null;
    return data;
}

export async function searchOrganizationByEmail(email: string): Promise<(DbOrganization & { owner_email?: string })[]> {
    // Search for organizations where the owner's email matches
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email.trim().toLowerCase());

    if (profileError || !profiles || profiles.length === 0) return [];

    const ownerIds = profiles.map(p => p.id);

    const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .in('owner_id', ownerIds);

    if (orgError || !orgs) return [];

    return orgs.map(org => ({
        ...org,
        owner_email: profiles.find(p => p.id === org.owner_id)?.email,
    }));
}
