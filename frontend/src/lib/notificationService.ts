import { supabase } from './supabase';

export interface DbNotification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: 'task_assigned' | 'task_review' | 'task_completed' | 'system';
    read: boolean;
    created_at: string;
    link_url?: string;
}

export async function fetchNotifications(): Promise<DbNotification[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }
    return data || [];
}

export async function sendNotification(userId: string, notification: {
    title: string;
    message: string;
    type: DbNotification['type'];
    link_url?: string;
}) {
    const { error } = await supabase
        .from('notifications')
        .insert({
            user_id: userId,
            ...notification,
            read: false
        });

    if (error) {
        console.error('Error sending notification:', error);
    }
}

export async function markAsRead(notificationId: string) {
    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

    if (error) throw error;
}

export async function markAllAsRead() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

    if (error) throw error;
}

export async function deleteNotification(notificationId: string) {
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

    if (error) throw error;
}
