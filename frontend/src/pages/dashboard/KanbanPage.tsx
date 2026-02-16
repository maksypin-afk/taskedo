import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchTasks, createTask, updateTask, removeTask } from '../../lib/taskService';
import { fetchTeam } from '../../lib/teamService';

import { supabase } from '../../lib/supabase';
import { getEligibleAssignees, getAllSubordinates } from '../../lib/hierarchy';
import { sendNotification } from '../../lib/notificationService';
import type { DbTask } from '../../lib/taskService';
import type { DbTeamMember } from '../../lib/teamService';
import { RichTextEditor } from '../../components/RichTextEditor';

const COLUMNS: DbTask['status'][] = ['new', 'progress', 'review', 'done'];

import { useOrg } from '../../lib/OrgContext';

export default function KanbanPage() {
    const { t } = useTranslation();
    const { activeOrgId, userOrgs } = useOrg();
    const [team, setTeam] = useState<DbTeamMember[]>([]);
    const [tasks, setTasks] = useState<DbTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [user, setUser] = useState<any>(null);
    const getLocalISOString = (date: Date) => {
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - offset).toISOString().slice(0, 16);
    };

    const [newPriority, setNewPriority] = useState<DbTask['priority']>('medium');
    const [newAssignee, setNewAssignee] = useState('');
    const [newDeadline, setNewDeadline] = useState(getLocalISOString(new Date()));
    const [newLink, setNewLink] = useState('');
    const [selectedTask, setSelectedTask] = useState<DbTask | null>(null);

    // Hierarchy logic
    const currentMember = team.find(m => m.user_id === user?.id);
    const eligibleAssignees = user ? getEligibleAssignees(team, user.id) : [];

    // Check if user is owner via Context
    const currentOrg = userOrgs.find(o => o.id === activeOrgId);
    const isOwner = currentOrg?.role === 'owner';
    const isManager = isOwner || (currentMember && (!currentMember.manager_id || getAllSubordinates(team, currentMember.id).length > 0));

    const loadData = useCallback(async () => {
        try {
            const currentOrg = activeOrgId;
            if (!currentOrg) {
                setLoading(false);
                return;
            }

            // Get current user for logic (assignments etc)
            const { data: { user: authUser } } = await supabase.auth.getUser();
            setUser(authUser);

            const [taskData, teamData] = await Promise.all([
                fetchTasks(currentOrg),
                fetchTeam(currentOrg)
            ]);
            setTasks(taskData);
            setTeam(teamData);

            // Default to current user if available, otherwise first team member
            if (!newAssignee) {
                if (teamData.length > 0) {
                    const currentUser = teamData.find(m => m.user_id === user?.id) || teamData[0];
                    const eligible = getEligibleAssignees(teamData, user?.id || '');
                    const defaultAssignee = eligible.find(m => m.user_id === user?.id) || eligible[0] || currentUser;
                    setNewAssignee(defaultAssignee.name);
                } else if (authUser) {
                    // Fallback for personal workspace (no team members)
                    setNewAssignee(authUser.user_metadata?.full_name || authUser.email || 'Me');
                }
            }
        } catch (err) {
            console.error('Failed to load data:', err);
        } finally {
            setLoading(false);
        }
    }, [newAssignee, activeOrgId, user?.id]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleDragStart = (id: string) => setDraggedId(id);

    const handleDrop = async (status: DbTask['status']) => {
        if (!draggedId) return;

        const task = tasks.find(t => t.id === draggedId);
        if (!task) return;

        // Restriction: Only Owner or Creator can move to 'done'
        if (status === 'done') {
            if (!isOwner && task.creator_id !== user?.id) {
                alert(t('dashboard.kanban.errors.onlyCreatorCanComplete') || 'Only the task creator or organization owner can mark a task as Done.');
                setDraggedId(null);
                return;
            }
        }

        // Optimistic update
        setTasks(prev => prev.map(t => t.id === draggedId ? { ...t, status } : t));
        setDraggedId(null);
        try {
            await updateTask(draggedId, { status });
        } catch (err) {
            console.error('Failed to update task:', err);
            loadData(); // rollback
        }
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim()) return;
        try {
            // Convert local input string to UTC ISO string before saving
            const deadlineDate = new Date(newDeadline);
            const isoDeadline = deadlineDate.toISOString();

            // Find the assignee's user_id from the team list
            const assigneeMember = team.find(m => m.name === newAssignee);
            let assigneeId = assigneeMember?.user_id || null;

            // If not found in team (e.g. personal workspace owner), check matches current user
            if (!assigneeId && user) {
                const userName = user.user_metadata?.full_name || user.email;
                if (newAssignee === userName || newAssignee === 'Me') {
                    assigneeId = user.id;
                }
            }

            await createTask({
                title: newTitle,
                description: newDesc,
                status: 'new',
                priority: newPriority,
                assignee: newAssignee,
                assignee_id: assigneeId,
                deadline: isoDeadline,
                link_url: newLink,
                organization_id: activeOrgId || ''
            });

            // Send notification to assignee
            if (assigneeMember && assigneeMember.user_id !== user?.id) {
                await sendNotification(assigneeMember.user_id, {
                    title: t('dashboard.notifications.new_task_title'),
                    message: `${t('dashboard.notifications.new_task_msg')}: ${newTitle}`,
                    type: 'task_assigned'
                });
            }

            setNewTitle('');
            setNewDesc('');
            setNewLink('');
            setNewAssignee(team[0]?.name || '');
            setNewDeadline(getLocalISOString(new Date()));
            setShowForm(false);
            loadData();
        } catch (err: any) {
            console.error('Failed to create task:', err);
        }
    };

    const handleTransition = async (task: DbTask, newStatus: DbTask['status']) => {
        try {
            // Optimistic update
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

            await updateTask(task.id, { status: newStatus });

            // If moving to review, notify the creator
            if (newStatus === 'review') {
                await sendNotification(task.creator_id, {
                    title: t('dashboard.notifications.task_review_title'),
                    message: `${t('dashboard.notifications.task_review_msg')}: ${task.title}`,
                    type: 'task_review'
                });
            }
        } catch (err) {
            console.error('Failed to transition task:', err);
            loadData();
        }
    };

    const handleDelete = async (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));
        try {
            await removeTask(id);
        } catch (err) {
            console.error('Failed to delete task:', err);
            loadData();
        }
    };

    const getLinkInfo = (url: string | null) => {
        if (!url) return null;
        try {
            const isGoogleDoc = url.includes('docs.google.com') || url.includes('drive.google.com');
            return {
                isGoogleDoc,
                icon: isGoogleDoc ? '📄' : '🔗',
                label: isGoogleDoc ? 'Google Doc' : 'Link'
            };
        } catch {
            return { isGoogleDoc: false, icon: '🔗', label: 'Link' };
        }
    };

    if (loading) {
        return (
            <div className="kanban-page">
                <div className="page-header">
                    <div>
                        <h1>{t('dashboard.kanban.title')}</h1>
                        <p>{t('dashboard.kanban.subtitle')}</p>
                    </div>
                </div>
                <div className="kanban-loading">{t('auth.loading')}</div>
            </div>
        );
    }

    return (
        <div className="kanban-page">
            <div className="page-header">
                <div>
                    <h1>{t('dashboard.kanban.title')}</h1>
                    <p>{t('dashboard.kanban.subtitle')}</p>
                </div>
                {isManager && (
                    <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                        + {t('dashboard.kanban.addTask')}
                    </button>
                )}
            </div>

            {/* New task form */}
            {showForm && (
                <form className="glass-card kanban-form animate-fade-in-up" onSubmit={handleAddTask}>
                    <input
                        type="text"
                        placeholder={t('dashboard.kanban.taskTitle')}
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        className="kanban-input"
                        autoFocus
                    />
                    <RichTextEditor
                        placeholder={t('dashboard.kanban.taskDesc')}
                        value={newDesc}
                        onChange={setNewDesc}
                        className="kanban-desc-editor"
                    />
                    <input
                        type="url"
                        placeholder="Link (Google Docs, etc.)"
                        value={newLink}
                        onChange={e => setNewLink(e.target.value)}
                        className="kanban-input"
                    />
                    <div className="kanban-form-row">
                        <select
                            value={newPriority}
                            onChange={e => setNewPriority(e.target.value as DbTask['priority'])}
                            className="kanban-select"
                        >
                            <option value="low">{t('dashboard.priority.low')}</option>
                            <option value="medium">{t('dashboard.priority.medium')}</option>
                            <option value="high">{t('dashboard.priority.high')}</option>
                        </select>
                        <select
                            value={newAssignee}
                            onChange={e => setNewAssignee(e.target.value)}
                            className="kanban-select"
                        >
                            {/* Always show current user if team is empty or not in team */}
                            {(eligibleAssignees.length === 0 || !eligibleAssignees.find(m => m.user_id === user?.id)) && (
                                <option value={user?.user_metadata?.full_name || user?.email || 'Me'}>
                                    {user?.user_metadata?.full_name || user?.email || 'Me'}
                                </option>
                            )}
                            {(isOwner ? team : eligibleAssignees).map(m => (
                                <option key={m.id} value={m.name}>{m.name}</option>
                            ))}
                        </select>
                        <input
                            type="datetime-local"
                            value={newDeadline}
                            onChange={e => setNewDeadline(e.target.value)}
                            className="kanban-input kanban-date-input"
                            style={{ flex: 1.5, colorScheme: 'dark' }}
                        />
                    </div>
                    <div className="kanban-form-row kanban-form-row-end">
                        <div className="kanban-form-actions">
                            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
                                {t('dashboard.kanban.cancel')}
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={!newTitle.trim()}>
                                {t('dashboard.kanban.create')}
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {/* Kanban board */}
            <div className="kanban-board">
                {COLUMNS.map(status => {
                    const columnTasks = tasks.filter(t =>
                        t.status === status &&
                        (
                            isOwner || // Owner sees all tasks
                            t.assignee_id === user?.id || // Always show my tasks
                            (t.assignee_id ? eligibleAssignees.some(ea => ea.user_id === t.assignee_id) : eligibleAssignees.some(ea => ea.name === t.assignee))
                        )
                    );
                    return (
                        <div
                            key={status}
                            className="kanban-column"
                            onDragOver={e => e.preventDefault()}
                            onDrop={() => handleDrop(status)}
                        >
                            <div className="kanban-column-header">
                                <span className={`kanban-column-dot status-bg-${status}`} />
                                <h3>{t(`dashboard.status.${status}`)}</h3>
                                <span className="kanban-count">{columnTasks.length}</span>
                            </div>
                            <div className="kanban-cards">
                                {columnTasks.map(task => {
                                    const linkInfo = getLinkInfo(task.link_url);
                                    const isOverdue = task.deadline && task.status !== 'done' && new Date(task.deadline) < new Date();

                                    return (
                                        <div
                                            key={task.id}
                                            className={`kanban-card glass-card ${draggedId === task.id ? 'dragging' : ''} ${isOverdue ? 'overdue' : ''}`}
                                            draggable
                                            onDragStart={() => handleDragStart(task.id)}
                                            onDragEnd={() => setDraggedId(null)}
                                            onClick={() => setSelectedTask(task)}
                                            role="button"
                                        >
                                            <div className="kanban-card-top">
                                                <span className={`task-priority-badge priority-${task.priority}`}>
                                                    {t(`dashboard.priority.${task.priority}`)}
                                                </span>
                                                <button
                                                    className="kanban-delete"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(task.id);
                                                    }}
                                                >✕</button>
                                            </div>
                                            <h4>{task.title}</h4>
                                            <div
                                                className="kanban-card-desc"
                                                dangerouslySetInnerHTML={{ __html: task.description || '' }}
                                            />

                                            {task.link_url && (
                                                <div className="task-card-link">
                                                    <a href={task.link_url} target="_blank" rel="noopener noreferrer" className={`link-badge ${linkInfo?.isGoogleDoc ? 'link-badge-doc' : ''}`}>
                                                        {linkInfo?.icon} {linkInfo?.label}
                                                    </a>
                                                </div>
                                            )}

                                            <div className="kanban-card-footer">
                                                {(task.status === 'new' && (task.assignee_id === user?.id || (!task.assignee_id && task.assignee === currentMember?.name)) ||
                                                    task.status === 'progress' && (task.assignee_id === user?.id || (!task.assignee_id && task.assignee === currentMember?.name)) ||
                                                    task.status === 'review' && task.creator_id === user?.id) && (
                                                        <div className="kanban-card-actions">
                                                            {task.status === 'new' && (task.assignee_id === user?.id || (!task.assignee_id && task.assignee === currentMember?.name)) && (
                                                                <button
                                                                    className="btn btn-sm btn-primary"
                                                                    onClick={(e) => { e.stopPropagation(); handleTransition(task, 'progress'); }}
                                                                >
                                                                    🚀 {t('dashboard.kanban.actions.start')}
                                                                </button>
                                                            )}
                                                            {task.status === 'progress' && (task.assignee_id === user?.id || (!task.assignee_id && task.assignee === currentMember?.name)) && (
                                                                <button
                                                                    className="btn btn-sm btn-primary"
                                                                    onClick={(e) => { e.stopPropagation(); handleTransition(task, 'review'); }}
                                                                >
                                                                    📤 {t('dashboard.kanban.actions.complete')}
                                                                </button>
                                                            )}
                                                            {task.status === 'review' && task.creator_id === user?.id && (
                                                                <button
                                                                    className="btn btn-sm btn-success"
                                                                    onClick={(e) => { e.stopPropagation(); handleTransition(task, 'done'); }}
                                                                >
                                                                    ✅ {t('dashboard.kanban.actions.approve')}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                <div className="kanban-card-meta">
                                                    <span className="kanban-assignee">👤 {(task.assignee_id && team.find(m => m.user_id === task.assignee_id)?.name) || task.assignee}</span>
                                                    <span className="kanban-date">
                                                        {task.deadline ? (
                                                            task.deadline.includes('T') && !task.deadline.endsWith('T00:00')
                                                                ? new Date(task.deadline).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                                : new Date(task.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' })
                                                        ) : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Task detail modal */}
            {selectedTask && (
                <div className="task-modal-overlay" onClick={() => setSelectedTask(null)}>
                    <div className="task-modal glass-card animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <div className="task-modal-header">
                            <h2>{selectedTask.title}</h2>
                            <button className="kanban-delete" style={{ opacity: 1 }} onClick={() => setSelectedTask(null)}>✕</button>
                        </div>

                        <div className="task-modal-body">
                            {selectedTask.description && (
                                <div className="task-modal-field">
                                    <span className="task-modal-label">{t('dashboard.kanban.taskDesc')}</span>
                                    <div
                                        className="task-modal-description"
                                        dangerouslySetInnerHTML={{ __html: selectedTask.description || '' }}
                                    />
                                </div>
                            )}

                            <div className="task-modal-grid">
                                <div className="task-modal-field">
                                    <span className="task-modal-label">{t('dashboard.calendar.taskDetails.status')}</span>
                                    <span className={`task-status-badge status-${selectedTask.status}`}>
                                        {t(`dashboard.status.${selectedTask.status}`)}
                                    </span>
                                </div>

                                <div className="task-modal-field">
                                    <span className="task-modal-label">{t('dashboard.calendar.taskDetails.priority')}</span>
                                    <span className={`task-priority-badge priority-${selectedTask.priority}`}>
                                        {t(`dashboard.priority.${selectedTask.priority}`)}
                                    </span>
                                </div>

                                <div className="task-modal-field">
                                    <span className="task-modal-label">{t('dashboard.calendar.taskDetails.assignee')}</span>
                                    <span className="task-modal-value">👤 {(selectedTask.assignee_id && team.find(m => m.user_id === selectedTask.assignee_id)?.name) || selectedTask.assignee || '—'}</span>
                                </div>

                                <div className="task-modal-field">
                                    <span className="task-modal-label">{t('dashboard.calendar.taskDetails.deadline')}</span>
                                    <span className="task-modal-value">
                                        📅 {selectedTask.deadline
                                            ? new Date(selectedTask.deadline).toLocaleString([], {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })
                                            : '—'}
                                    </span>
                                </div>

                                {selectedTask.link_url && (
                                    <div className="task-modal-field task-modal-full">
                                        <span className="task-modal-label">Link</span>
                                        <a href={selectedTask.link_url} target="_blank" rel="noopener noreferrer" className={`link-badge ${getLinkInfo(selectedTask.link_url)?.isGoogleDoc ? 'link-badge-doc' : ''}`}>
                                            {getLinkInfo(selectedTask.link_url)?.icon} {getLinkInfo(selectedTask.link_url)?.label}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="task-modal-footer">
                            <button className="btn btn-outline" onClick={() => setSelectedTask(null)}>
                                {t('dashboard.calendar.taskDetails.close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
