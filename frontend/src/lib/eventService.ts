import { supabase } from './supabase';

export interface DbEvent {
    id: string;
    user_id: string;
    title: string;
    date: string;
    type: 'meeting' | 'deadline' | 'task' | 'event';
    color: string;
    organization_id: string;
    created_at: string;
}

export async function fetchEvents(organizationId: string): Promise<DbEvent[]> {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('organization_id', organizationId)
        .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
}

export async function createEvent(event: {
    title: string;
    date: string;
    type: string;
    color: string;
    organization_id: string;
}): Promise<DbEvent> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('events')
        .insert({
            user_id: user.id,
            title: event.title,
            date: event.date,
            type: event.type,
            color: event.color,
            organization_id: event.organization_id,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function removeEvent(eventId: string) {
    const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

    if (error) throw error;
}
