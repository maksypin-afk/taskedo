import { supabase } from './supabase';

export interface DbTask {
    id: string;
    user_id: string;
    creator_id: string; // The person who assigned the task
    title: string;
    description: string;
    status: 'new' | 'progress' | 'review' | 'done';
    priority: 'low' | 'medium' | 'high';
    assignee: string;
    assignee_id: string | null;
    deadline: string | null;
    link_url: string | null;
    organization_id: string;
    created_at: string;
}

export async function fetchTasks(organizationId: string): Promise<DbTask[]> {
    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function createTask(task: {
    title: string;
    description: string;
    status: string;
    priority: string;
    assignee: string;
    assignee_id: string | null;
    deadline: string;
    link_url?: string;
    organization_id: string;
}): Promise<DbTask> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
        .from('tasks')
        .insert({
            user_id: user.id,
            creator_id: user.id, // Store who created the task
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            assignee: task.assignee,
            assignee_id: task.assignee_id,
            deadline: task.deadline || null,
            link_url: task.link_url || null,
            organization_id: task.organization_id,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateTask(taskId: string, updates: Partial<Pick<DbTask, 'status' | 'title' | 'description' | 'priority' | 'assignee' | 'assignee_id' | 'deadline' | 'link_url'>>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Not authenticated');
    }

    const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);

    if (error) throw error;
}

export async function removeTask(taskId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Not authenticated');
    }

    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

    if (error) throw error;
}
