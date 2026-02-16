import { supabase } from './supabase';

export interface DbProfile {
    id: string;
    display_name: string;
    email: string;
    birthday: string | null;
    phone: string;
    avatar_url: string;
    whatsapp: string | null;
    telegram: string | null;
    organization: string | null;
    organization_id: string | null;
    created_at: string;
    updated_at: string;
}

export async function fetchProfile(): Promise<DbProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) throw error;
    return data;
}

export async function updateProfile(updates: {
    display_name?: string;
    birthday?: string | null;
    phone?: string;
    avatar_url?: string;
    whatsapp?: string | null;
    telegram?: string | null;
    organization?: string | null;
}): Promise<DbProfile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function uploadAvatar(file: File): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

    return publicUrl;
}

export async function getUserEmail(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email || '';
}
