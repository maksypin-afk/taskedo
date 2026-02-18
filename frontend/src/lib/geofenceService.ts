import { supabase } from './supabase';

export interface DbGeofence {
    id: string;
    organization_id: string;
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
    created_at: string;
}

export interface DbAttendanceLog {
    id: string;
    user_id: string;
    organization_id: string;
    geofence_id: string | null;
    check_in: string;
    check_out: string | null;
    date: string;
    created_at: string;
    // joined fields
    user_name?: string;
    user_avatar?: string;
}

// ===== GEOFENCES =====

export async function fetchGeofences(orgId: string): Promise<DbGeofence[]> {
    const { data, error } = await supabase
        .from('geofences')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('fetchGeofences error:', error);
        return [];
    }
    return data || [];
}

export async function createGeofence(
    orgId: string,
    geofence: { name: string; latitude: number; longitude: number; radius: number }
): Promise<DbGeofence | null> {
    const { data, error } = await supabase
        .from('geofences')
        .insert({
            organization_id: orgId,
            name: geofence.name,
            latitude: geofence.latitude,
            longitude: geofence.longitude,
            radius: geofence.radius,
        })
        .select()
        .single();

    if (error) {
        console.error('createGeofence error:', error);
        return null;
    }
    return data;
}

export async function updateGeofence(
    id: string,
    updates: Partial<{ name: string; latitude: number; longitude: number; radius: number }>
): Promise<boolean> {
    const { error } = await supabase
        .from('geofences')
        .update(updates)
        .eq('id', id);

    if (error) {
        console.error('updateGeofence error:', error);
        return false;
    }
    return true;
}

export async function deleteGeofence(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('geofences')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('deleteGeofence error:', error);
        return false;
    }
    return true;
}

// ===== ATTENDANCE LOGS =====

export async function fetchAttendanceLogs(
    orgId: string,
    date?: string
): Promise<DbAttendanceLog[]> {
    let query = supabase
        .from('attendance_logs')
        .select('*')
        .eq('organization_id', orgId)
        .order('check_in', { ascending: false });

    if (date) {
        query = query.eq('date', date);
    }

    const { data, error } = await query.limit(100);

    if (error) {
        console.error('fetchAttendanceLogs error:', error);
        return [];
    }

    // Enrich with user names from profiles
    if (data && data.length > 0) {
        const userIds = [...new Set(data.map(l => l.user_id))];
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', userIds);

        const profileMap = new Map(
            (profiles || []).map(p => [p.id, { name: p.display_name, avatar: p.avatar_url }])
        );

        return data.map(log => ({
            ...log,
            user_name: profileMap.get(log.user_id)?.name || 'Unknown',
            user_avatar: profileMap.get(log.user_id)?.avatar || undefined,
        }));
    }

    return data || [];
}
