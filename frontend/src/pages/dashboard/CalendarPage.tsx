import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchTasks } from '../../lib/taskService';
import { fetchEvents, createEvent, removeEvent } from '../../lib/eventService';
import { fetchTeam, type DbTeamMember } from '../../lib/teamService';

import { supabase } from '../../lib/supabase';
import { getVisibleAssigneeNames, getVisibleUserIds } from '../../lib/hierarchy';
import type { DbTask } from '../../lib/taskService';
import type { DbEvent } from '../../lib/eventService';
import { useOrg } from '../../lib/OrgContext';

interface CalendarItem {
    id: string;
    title: string;
    color: string;
    type: 'task-deadline' | 'meeting' | 'deadline' | 'task' | 'event';
    source: 'task' | 'event';
    link_url?: string | null;
    time?: string | null;
}

const TYPE_COLORS: Record<string, string> = {
    meeting: '#6366f1',
    deadline: '#f87171',
    task: '#34d399',
    event: '#fbbf24',
    'task-deadline': '#f87171',
};

export default function CalendarPage() {
    const { t } = useTranslation();
    const { activeOrgId, userOrgs } = useOrg();

    // Check if user is owner
    const currentOrg = userOrgs.find(o => o.id === activeOrgId);
    const isOwner = currentOrg?.role === 'owner';

    const [currentDate, setCurrentDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [tasks, setTasks] = useState<DbTask[]>([]);
    const [events, setEvents] = useState<DbEvent[]>([]);
    const [team, setTeam] = useState<DbTeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDate, setNewDate] = useState('');
    const [newType, setNewType] = useState<string>('meeting');
    const [selectedTask, setSelectedTask] = useState<DbTask | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<DbEvent | null>(null);
    const [selectedDay, setSelectedDay] = useState<{ day: number; dateStr: string; items: CalendarItem[] } | null>(null);
    const [user, setUser] = useState<any>(null);

    // Visibility logic
    const visibleNames = user ? getVisibleAssigneeNames(team, user.id) : [];
    const visibleUserIds = user ? getVisibleUserIds(team, user.id) : [];

    const loadData = useCallback(async () => {
        try {
            const currentOrg = activeOrgId;
            if (!currentOrg) {
                setLoading(false);
                return;
            }

            const [t, e, teamData, { data: { user: authUser } }] = await Promise.all([
                fetchTasks(currentOrg),
                fetchEvents(currentOrg),
                fetchTeam(currentOrg),
                supabase.auth.getUser()
            ]);
            setTasks(t);
            setEvents(e);
            setTeam(teamData);
            setUser(authUser);
        } catch (err) {
            console.error('Failed to load calendar data:', err);
        } finally {
            setLoading(false);
        }
    }, [activeOrgId]);

    useEffect(() => { loadData(); }, [loadData]);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    const monthNames = [
        'dashboard.calendar.months.jan', 'dashboard.calendar.months.feb', 'dashboard.calendar.months.mar',
        'dashboard.calendar.months.apr', 'dashboard.calendar.months.may', 'dashboard.calendar.months.jun',
        'dashboard.calendar.months.jul', 'dashboard.calendar.months.aug', 'dashboard.calendar.months.sep',
        'dashboard.calendar.months.oct', 'dashboard.calendar.months.nov', 'dashboard.calendar.months.dec',
    ];

    const dayNames = [
        'dashboard.calendar.days.sun', 'dashboard.calendar.days.mon', 'dashboard.calendar.days.tue',
        'dashboard.calendar.days.wed', 'dashboard.calendar.days.thu', 'dashboard.calendar.days.fri',
        'dashboard.calendar.days.sat',
    ];

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    // Build items map: date string -> items
    const itemsMap = new Map<string, CalendarItem[]>();

    const parseCalendarDate = (dateStr: string) => {
        if (!dateStr) return null;

        // isTimed is true if the string has a time-like pattern (HH:mm)
        const isTimed = /[:\d]\d:\d\d/.test(dateStr);
        const dateObj = new Date(dateStr.replace(' ', 'T'));
        if (isNaN(dateObj.getTime())) return null;

        return { dateObj, isTimed };
    };

    const formatCalendarDateTime = (dateStr: string | null) => {
        if (!dateStr) return '—';
        const parsed = parseCalendarDate(dateStr);
        if (!parsed) return '—';

        const { dateObj, isTimed } = parsed;
        const options: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };

        if (isTimed) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }

        return dateObj.toLocaleString([], options);
    };

    tasks.forEach(task => {
        if (!task.deadline) return;

        // Visibility Filter (Try ID first, fallback to name for old tasks)
        const isVisible = isOwner || (task.assignee_id === user?.id) || (task.assignee_id
            ? visibleUserIds.includes(task.assignee_id)
            : visibleNames.includes(task.assignee));

        if (!isVisible) return;

        const parsed = parseCalendarDate(task.deadline);
        if (!parsed) return;

        const { dateObj, isTimed } = parsed;
        const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

        let timeStr = null;
        if (isTimed) {
            const h = String(dateObj.getHours()).padStart(2, '0');
            const m = String(dateObj.getMinutes()).padStart(2, '0');
            timeStr = `${h}:${m}`;
        }

        const items = itemsMap.get(dateStr) || [];
        items.push({
            id: task.id,
            title: task.title,
            color: TYPE_COLORS['task-deadline'],
            type: 'task-deadline',
            source: 'task',
            link_url: task.link_url,
            time: timeStr
        });

        itemsMap.set(dateStr, items.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00')));
    });

    events.forEach(ev => {
        if (!ev.date) return;

        const parsed = parseCalendarDate(ev.date);
        if (!parsed) return;

        const { dateObj, isTimed } = parsed;
        const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

        let timeStr = null;
        if (isTimed) {
            const h = String(dateObj.getHours()).padStart(2, '0');
            const m = String(dateObj.getMinutes()).padStart(2, '0');
            timeStr = `${h}:${m}`;
        }

        const items = itemsMap.get(dateStr) || [];
        items.push({
            id: ev.id,
            title: ev.title,
            color: ev.color || TYPE_COLORS[ev.type] || '#6366f1',
            type: ev.type,
            source: 'event',
            time: timeStr
        });

        itemsMap.set(dateStr, items.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00')));
    });

    // Build calendar cells
    const cells: { day: number | null; items: CalendarItem[] }[] = [];
    const offset = firstDay === 0 ? 6 : firstDay - 1; // Monday-first
    for (let i = 0; i < offset; i++) cells.push({ day: null, items: [] });
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push({ day: d, items: itemsMap.get(dateStr) || [] });
    }

    const isToday = (day: number | null) =>
        day !== null && today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;

    const handleAddEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim() || !newDate) return;
        try {
            // Send exactly as YYYY-MM-DDTHH:mm from input (Supabase will treat as local/UTC depending on column, but it's safer)
            // Or better: ensure it's saved as a proper ISO string that matches local intent
            const dateObj = new Date(newDate);
            await createEvent({
                title: newTitle,
                date: dateObj.toISOString(),
                type: newType,
                color: TYPE_COLORS[newType] || '#6366f1',
                organization_id: activeOrgId || ''
            });
            setNewTitle('');
            setNewDate('');
            setShowForm(false);
            loadData();
        } catch (err) {
            console.error('Failed to create event:', err);
        }
    };

    const handleDeleteEvent = async (id: string) => {
        setEvents(prev => prev.filter(e => e.id !== id));
        try {
            await removeEvent(id);
        } catch (err) {
            console.error('Failed to delete event:', err);
            loadData();
        }
    };

    const handleItemClick = (item: CalendarItem) => {
        if (item.source === 'task') {
            const task = tasks.find(t => t.id === item.id);
            if (task) setSelectedTask(task);
        } else {
            const event = events.find(e => e.id === item.id);
            if (event) setSelectedEvent(event);
        }
    };

    const getLinkInfo = (url: string | null | undefined) => {
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
            <div className="calendar-page">
                <div className="page-header">
                    <h1>{t('dashboard.calendar.title')}</h1>
                    <p>{t('dashboard.calendar.subtitle')}</p>
                </div>
                <div className="kanban-loading">{t('auth.loading')}</div>
            </div>
        );
    }

    return (
        <div className="calendar-page">
            <div className="page-header">
                <div>
                    <h1>{t('dashboard.calendar.title')}</h1>
                    <p>{t('dashboard.calendar.subtitle')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    + {t('dashboard.calendar.event')}
                </button>
            </div>

            {/* Add event form */}
            {showForm && (
                <form className="glass-card kanban-form animate-fade-in-up" onSubmit={handleAddEvent}>
                    <input
                        type="text"
                        placeholder={t('dashboard.calendar.event')}
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        className="kanban-input"
                        autoFocus
                    />
                    <div className="kanban-form-row">
                        <input
                            type="datetime-local"
                            value={newDate}
                            onChange={e => setNewDate(e.target.value)}
                            className="kanban-input kanban-date-input"
                        />
                        <select
                            value={newType}
                            onChange={e => setNewType(e.target.value)}
                            className="kanban-select"
                        >
                            <option value="meeting">{t('dashboard.calendar.meeting')}</option>
                            <option value="deadline">{t('dashboard.calendar.deadline')}</option>
                            <option value="event">{t('dashboard.calendar.event')}</option>
                        </select>
                        <div className="kanban-form-actions">
                            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
                                {t('dashboard.kanban.cancel')}
                            </button>
                            <button type="submit" className="btn btn-primary">
                                {t('dashboard.kanban.create')}
                            </button>
                        </div>
                    </div>
                </form>
            )}

            <div className="glass-card calendar-card">
                {/* Calendar header */}
                <div className="calendar-header">
                    <button className="calendar-nav-btn" onClick={prevMonth}>◀</button>
                    <h2>{t(monthNames[month])} {year}</h2>
                    <button className="calendar-nav-btn" onClick={nextMonth}>▶</button>
                </div>

                {/* Day names */}
                <div className="calendar-grid calendar-days-header">
                    {dayNames.map(d => (
                        <div key={d} className="calendar-day-name">{t(d)}</div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="calendar-grid">
                    {cells.map((cell, idx) => {
                        const MAX_VISIBLE = 3;
                        const visibleItems = cell.items.slice(0, MAX_VISIBLE);
                        const hiddenCount = cell.items.length - MAX_VISIBLE;
                        const openDay = () => {
                            if (cell.day !== null) {
                                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
                                setSelectedDay({ day: cell.day, dateStr, items: cell.items });
                            }
                        };
                        return (
                            <div key={idx} className={`calendar-cell ${cell.day === null ? 'empty' : ''} ${isToday(cell.day) ? 'today' : ''}`} onClick={openDay} style={{ cursor: cell.day !== null ? 'pointer' : undefined }}>
                                {cell.day && <span className="calendar-day-number">{cell.day}</span>}
                                <div className="calendar-cell-events">
                                    {visibleItems.map(item => (
                                        <div
                                            key={item.id}
                                            className={`calendar-event ${item.source === 'task' ? 'calendar-event-task' : ''}`}
                                            style={{ borderLeftColor: item.color, background: `${item.color}15` }}
                                            title={item.source === 'task' ? `📋 ${item.title}` : `${item.title}`}
                                            onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                                            role="button"
                                        >
                                            <span className="calendar-event-dot" style={{ background: item.color }} />
                                            <span className="calendar-event-title">
                                                {item.time && <span className="calendar-event-time">{item.time} </span>}
                                                {item.title}
                                            </span>
                                        </div>
                                    ))}
                                    {hiddenCount > 0 && (
                                        <span className="calendar-more-btn">
                                            +{hiddenCount} {t('dashboard.calendar.more') || 'ещё'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="calendar-legend">
                <span className="legend-item"><span className="legend-dot" style={{ background: '#f87171' }} /> {t('dashboard.calendar.deadline')}</span>
                <span className="legend-item"><span className="legend-dot" style={{ background: '#6366f1' }} /> {t('dashboard.calendar.meeting')}</span>
                <span className="legend-item"><span className="legend-dot" style={{ background: '#fbbf24' }} /> {t('dashboard.calendar.event')}</span>
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
                                        📅 {formatCalendarDateTime(selectedTask.deadline)}
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

            {/* Event detail modal */}
            {selectedEvent && (
                <div className="task-modal-overlay" onClick={() => setSelectedEvent(null)}>
                    <div className="task-modal glass-card animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <div className="task-modal-header" style={{ borderLeft: `4px solid ${selectedEvent.color || '#6366f1'}` }}>
                            <h2>{selectedEvent.title}</h2>
                            <button className="kanban-delete" style={{ opacity: 1 }} onClick={() => setSelectedEvent(null)}>✕</button>
                        </div>

                        <div className="task-modal-body">
                            <div className="task-modal-grid">
                                <div className="task-modal-field">
                                    <span className="task-modal-label">{t('dashboard.calendar.taskDetails.status')}</span>
                                    <span style={{
                                        color: selectedEvent.color || '#6366f1',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        fontSize: '0.8rem'
                                    }}>
                                        {t(`dashboard.calendar.${selectedEvent.type}`)}
                                    </span>
                                </div>

                                <div className="task-modal-field">
                                    <span className="task-modal-label">{t('dashboard.calendar.taskDetails.deadline')}</span>
                                    <span className="task-modal-value">
                                        📅 {formatCalendarDateTime(selectedEvent.date)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="task-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                            <button
                                className="btn btn-danger"
                                style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                                onClick={() => {
                                    handleDeleteEvent(selectedEvent.id);
                                    setSelectedEvent(null);
                                }}
                            >
                                {t('dashboard.team.delete')}
                            </button>
                            <button className="btn btn-outline" onClick={() => setSelectedEvent(null)}>
                                {t('dashboard.calendar.taskDetails.close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Day detail modal */}
            {selectedDay && (
                <div className="task-modal-overlay" onClick={() => setSelectedDay(null)}>
                    <div className="task-modal glass-card animate-fade-in-up" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                        <div className="task-modal-header">
                            <h2>{selectedDay.day} {t(monthNames[month])} {year}</h2>
                            <button className="kanban-delete" style={{ opacity: 1 }} onClick={() => setSelectedDay(null)}>✕</button>
                        </div>

                        <div className="task-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: 0 }}>
                            {selectedDay.items.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                                    {t('dashboard.calendar.noEvents') || 'Нет событий на этот день'}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {selectedDay.items.map(item => {
                                        const linkInfo = getLinkInfo(item.link_url);
                                        return (
                                            <div
                                                key={item.id}
                                                className="day-modal-item"
                                                onClick={() => {
                                                    setSelectedDay(null);
                                                    handleItemClick(item);
                                                }}
                                                role="button"
                                            >
                                                <span className="calendar-event-dot" style={{ background: item.color, width: 8, height: 8, flexShrink: 0 }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 2 }}>{item.title}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                        {item.time && <span>🕐 {item.time}</span>}
                                                        <span style={{ color: item.color, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                                                            {item.source === 'task' ? '📋 ' + t('dashboard.calendar.deadline') : t(`dashboard.calendar.${item.type}`)}
                                                        </span>
                                                    </div>
                                                </div>
                                                {item.link_url && <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>{linkInfo?.icon}</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="task-modal-footer">
                            <button className="btn btn-outline" onClick={() => setSelectedDay(null)}>
                                {t('dashboard.calendar.taskDetails.close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
