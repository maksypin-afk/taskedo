import { supabase } from './supabase';

export interface DbAnnouncement {
    id: string;
    user_id: string;
    content: string;
    author_name: string | null;
    type: 'announcement' | 'birthday';
    organization_id: string;
    created_at: string;
}

export async function fetchTodayAnnouncements(organizationId: string): Promise<DbAnnouncement[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function createAnnouncement(content: string): Promise<DbAnnouncement> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Not authenticated');
    }

    // Получаем имя автора и ID организации из профиля (приоритетно) или из метаданных
    const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, organization_id')
        .eq('id', user.id)
        .single();

    const orgId = profile?.organization_id || user.user_metadata?.organization_id;

    if (!orgId) {
        throw new Error('No organization_id found for user');
    }

    const authorName = profile?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown';

    const { data, error } = await supabase
        .from('announcements')
        .insert({
            user_id: user.id,
            content,
            author_name: authorName,
            type: 'announcement',
            organization_id: orgId
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteAnnouncement(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Not authenticated');
    }

    const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

    if (error) throw error;
}
