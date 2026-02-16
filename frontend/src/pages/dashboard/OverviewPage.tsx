import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchTasks, type DbTask } from '../../lib/taskService';
import { fetchTeam, ensureOwnerMember, type DbTeamMember } from '../../lib/teamService';
import { fetchTodayAnnouncements, createAnnouncement, deleteAnnouncement, type DbAnnouncement } from '../../lib/announcementService';
import { getInitials } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { getVisibleAssigneeNames, getVisibleUserIds } from '../../lib/hierarchy';

import { useOrg } from '../../lib/OrgContext';

export default function OverviewPage() {
    const { t } = useTranslation();
    const { activeOrgId, userOrgs } = useOrg();
    const currentOrg = userOrgs.find(o => o.id === activeOrgId);
    const isOwner = currentOrg?.role === 'owner';

    const [team, setTeam] = useState<DbTeamMember[]>([]);
    const [tasks, setTasks] = useState<DbTask[]>([]);
    const [announcements, setAnnouncements] = useState<DbAnnouncement[]>([]);
    const [newMsg, setNewMsg] = useState('');
    // Removed local organization state
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [weather, setWeather] = useState<{ temp: number; code: number; city: string } | null>(null);
    const [user, setUser] = useState<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const loadData = async () => {
        if (!activeOrgId) return;
        setLoading(true);
        try {

            // Ensure owner is synced before loading team
            try {
                await ensureOwnerMember(activeOrgId);
            } catch (err) {
                console.warn('Failed to sync owner member:', err);
            }

            const results = await Promise.allSettled([
                fetchTasks(activeOrgId),
                fetchTeam(activeOrgId),
                fetchTodayAnnouncements(activeOrgId),
                supabase.auth.getUser()
            ]);

            if (results[0].status === 'fulfilled') setTasks(results[0].value);
            else console.error('Error fetching tasks:', results[0].reason);

            if (results[1].status === 'fulfilled') setTeam(results[1].value);
            else console.error('Error fetching team:', results[1].reason);

            if (results[2].status === 'fulfilled') setAnnouncements(results[2].value);
            else console.error('Error fetching announcements:', results[2].reason);

            if (results[3].status === 'fulfilled') setUser(results[3].value.data.user);

        } catch (err) {
            console.error('Unexpected error in loadData:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMsg.trim()) return;
        try {
            await createAnnouncement(newMsg);
            setNewMsg('');
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteMsg = async (id: string) => {
        try {
            await deleteAnnouncement(id);
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const today = new Date();

    const birthdaysToday = team.filter(m => {
        if (!m.birthday) return false;
        // Robust date matching regardless of timezone/Date constructor quirks
        // Expects YYYY-MM-DD
        const parts = m.birthday.split('-');
        if (parts.length < 3) return false;
        const bMonth = parseInt(parts[1], 10);
        const bDay = parseInt(parts[2], 10);
        return bMonth === (today.getMonth() + 1) && bDay === today.getDate();
    });

    const fetchWeather = async () => {
        const getCoords = (): Promise<{ lat: number; lon: number }> => {
            return new Promise((resolve) => {
                if (!navigator.geolocation) {
                    resolve({ lat: 42.87, lon: 74.59 }); // Fallback
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                    () => resolve({ lat: 42.87, lon: 74.59 }), // Fallback on error
                    { timeout: 10000 }
                );
            });
        };

        try {
            const { lat, lon } = await getCoords();

            // Parallel fetch for weather and city name
            const [weatherRes, geoRes] = await Promise.all([
                fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`),
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`, {
                    headers: {
                        'Accept-Language': 'ru,en',
                        'User-Agent': 'Taskedo-App/1.0'
                    }
                })
            ]);

            const weatherData = await weatherRes.json();
            const geoData = await geoRes.json();

            if (weatherData.current_weather) {
                // Try to find the most relevant city/town/village name
                const city = geoData.address?.city ||
                    geoData.address?.town ||
                    geoData.address?.village ||
                    geoData.address?.suburb ||
                    'Бишкек';

                setWeather({
                    temp: Math.round(weatherData.current_weather.temperature),
                    code: weatherData.current_weather.weathercode,
                    city: city
                });
            }
        } catch (err) {
            console.error('Weather fetch failed:', err);
        }
    };

    useEffect(() => {
        loadData();
        fetchWeather();
        const timers = setInterval(() => setCurrentTime(new Date()), 1000);
        const weatherTimer = setInterval(fetchWeather, 1800000); // Update every 30 mins
        return () => {
            clearInterval(timers);
            clearInterval(weatherTimer);
        };
    }, [activeOrgId]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            const canScrollLeft = el.scrollLeft > 0;
            const canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth;

            if ((e.deltaY > 0 && canScrollRight) || (e.deltaY < 0 && canScrollLeft)) {
                el.scrollLeft += e.deltaY;
                e.preventDefault();
            }
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [announcements, birthdaysToday]);

    // Visibility logic
    const visibleTeam = team;
    const visibleAssigneeNames = user ? getVisibleAssigneeNames(team, user.id) : [];
    const visibleUserIds = user ? getVisibleUserIds(team, user.id) : [];

    const visibleTasks = tasks.filter(t =>
        isOwner ||
        (t.assignee_id === user?.id) ||
        (t.assignee_id
            ? visibleUserIds.includes(t.assignee_id)
            : visibleAssigneeNames.includes(t.assignee))
    );

    const stats = {
        total: visibleTasks.length,
        done: visibleTasks.filter(t => t.status === 'done').length,
        progress: visibleTasks.filter(t => t.status === 'progress').length,
        overdue: visibleTasks.filter(t => {
            if (!t.deadline || t.status === 'done') return false;
            const deadline = new Date(t.deadline);
            const now = new Date();
            return deadline < now;
        }).length,
        teamOnline: visibleTeam.filter(m => m.status === 'online').length,
    };

    const recentTasks = visibleTasks.slice(0, 5);

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

    const getWeatherIcon = (code: number) => {
        if (code === 0) return '☀️'; // Clear sky
        if (code <= 3) return '🌤️'; // Partly cloudy
        if (code >= 51 && code <= 67) return '🌧️'; // Rain
        if (code >= 71 && code <= 77) return '❄️'; // Snow
        if (code >= 80 && code <= 82) return '🚿'; // Rain showers
        if (code >= 95) return '⛈️'; // Thunderstorm
        return '☁️'; // Cloudy/default
    };

    return (
        <div className="overview-page">
            <div className="overview-header-row animate-fade-in">
                <div className="overview-clock-widget">
                    <div className="clock-time">
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div className="clock-date">
                        {currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                </div>

                {weather && (
                    <div className="overview-weather-widget">
                        <div className="weather-main">
                            <span className="weather-icon">{getWeatherIcon(weather.code)}</span>
                            <span className="weather-temp">{weather.temp}°C</span>
                        </div>
                        <div className="weather-city">{weather.city}</div>
                    </div>
                )}
            </div>

            {/* Daily Board */}
            <div className="glass-card daily-board animate-fade-in-up">
                <div className="daily-board-header">
                    <h3>⚡ {t('dashboard.overview.dailyBoard')}</h3>
                    <form className="daily-board-post" onSubmit={handlePost}>
                        <input
                            type="text"
                            placeholder={t('dashboard.overview.postPlaceholder')}
                            value={newMsg}
                            onChange={e => setNewMsg(e.target.value)}
                        />
                        <button type="submit"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg></button>
                    </form>
                </div>
                <div
                    className="daily-board-content"
                    ref={scrollRef}
                >
                    {birthdaysToday.map(m => (
                        <div key={m.id} className="daily-item birthday-item">
                            <span className="daily-item-icon">🎂</span>
                            <div className="daily-item-text">
                                <strong>{m.name}</strong>
                                <span>{t('dashboard.overview.birthdayWish')}</span>
                            </div>
                        </div>
                    ))}
                    {announcements.map(a => (
                        <div key={a.id} className="daily-item announcement-item">
                            <span className="daily-item-icon">📢</span>
                            <div className="daily-item-text">
                                <strong>{a.author_name}</strong>
                                <span>{a.content}</span>
                            </div>
                            <button className="daily-item-delete" onClick={() => handleDeleteMsg(a.id)}>✕</button>
                        </div>
                    ))}
                    {birthdaysToday.length === 0 && announcements.length === 0 && !loading && (
                        <div className="daily-board-empty">
                            {t('dashboard.overview.dailyEmpty')}
                        </div>
                    )}
                </div>
            </div>

            {/* Stats cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>📋</div>
                    <div className="stat-info">
                        <span className="stat-value">{loading ? '—' : stats.total}</span>
                        <span className="stat-label">{t('dashboard.overview.totalTasks')}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}>✅</div>
                    <div className="stat-info">
                        <span className="stat-value">{loading ? '—' : stats.done}</span>
                        <span className="stat-label">{t('dashboard.overview.completed')}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }}>⚡</div>
                    <div className="stat-info">
                        <span className="stat-value">{loading ? '—' : stats.progress}</span>
                        <span className="stat-label">{t('dashboard.overview.inProgress')}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f87171, #ef4444)' }}>⏰</div>
                    <div className="stat-info">
                        <span className="stat-value">{loading ? '—' : stats.overdue}</span>
                        <span className="stat-label">{t('dashboard.overview.overdue')}</span>
                    </div>
                </div>
            </div>

            {/* Recent + Team */}
            <div className="overview-grid">
                <div className="glass-card overview-card">
                    <h3>{t('dashboard.overview.recentTasks')}</h3>
                    <div className="recent-tasks-list">
                        {loading ? (
                            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>{t('auth.loading')}</p>
                        ) : recentTasks.length === 0 ? (
                            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>—</p>
                        ) : recentTasks.map(task => {
                            const linkInfo = getLinkInfo(task.link_url);
                            return (
                                <div key={task.id} className="recent-task-item">
                                    <div className={`task-priority-dot priority-${task.priority}`} />
                                    <div className="recent-task-info">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span className="recent-task-title">{task.title}</span>
                                            {task.link_url && (
                                                <span title={linkInfo?.label} style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                                                    {linkInfo?.icon}
                                                </span>
                                            )}
                                        </div>
                                        <span className="recent-task-meta">
                                            {team.find(m => m.user_id === task.assignee_id)?.name || task.assignee} · {task.deadline ? (
                                                task.deadline.includes('T') && !task.deadline.endsWith('T00:00')
                                                    ? new Date(task.deadline).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                    : new Date(task.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' })
                                            ) : ''}
                                        </span>
                                    </div>
                                    <span className={`task-status-badge status-${task.status}`}>
                                        {t(`dashboard.status.${task.status}`)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="glass-card overview-card">
                    <h3>{t('dashboard.overview.teamActivity')}</h3>
                    <div className="team-activity-list">
                        {visibleTeam.map(member => (
                            <div key={member.id} className="team-activity-item">
                                <div className="team-member-avatar">
                                    {getInitials(member.name)}
                                </div>
                                <div className="team-member-info">
                                    <span className="team-member-name">{member.name}</span>
                                    <span className="team-member-role">{member.role}</span>
                                </div>
                                <span className={`status-indicator status-${member.status}`}>
                                    {t(`dashboard.memberStatus.${member.status}`)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
