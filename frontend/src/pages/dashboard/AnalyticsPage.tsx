import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchTasks } from '../../lib/taskService';
import { fetchTeam } from '../../lib/teamService';

import type { DbTask } from '../../lib/taskService';
import type { DbTeamMember } from '../../lib/teamService';
import { getInitials } from '../../lib/utils';

import { useOrg } from '../../lib/OrgContext';

export default function AnalyticsPage() {
    const { t } = useTranslation();
    const { activeOrgId } = useOrg();
    const [team, setTeam] = useState<DbTeamMember[]>([]);
    const [tasks, setTasks] = useState<DbTask[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (!activeOrgId) {
                setLoading(false);
                return;
            }

            try {
                // 1. Fetch all tasks for the org
                const [tasksData, teamData] = await Promise.all([
                    fetchTasks(activeOrgId),
                    fetchTeam(activeOrgId)
                ]);
                setTasks(tasksData);
                setTeam(teamData);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [activeOrgId]);

    const done = tasks.filter(t => t.status === 'done').length;
    const progress = tasks.filter(t => t.status === 'progress').length;
    const review = tasks.filter(t => t.status === 'review').length;
    const newTasks = tasks.filter(t => t.status === 'new').length;
    const total = tasks.length;

    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    const assigneeStats = team.map(member => {
        const memberTasks = tasks.filter(t => t.assignee === member.name);
        const memberDone = memberTasks.filter(t => t.status === 'done').length;
        return { name: member.name, avatar: member.avatar, total: memberTasks.length, done: memberDone };
    });

    const priorities = {
        high: tasks.filter(t => t.priority === 'high').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        low: tasks.filter(t => t.priority === 'low').length,
    };

    if (loading) {
        return (
            <div className="analytics-page">
                <div className="page-header">
                    <h1>{t('dashboard.analytics.title')}</h1>
                    <p>{t('dashboard.analytics.subtitle')}</p>
                </div>
                <div className="kanban-loading">{t('auth.loading')}</div>
            </div>
        );
    }

    return (
        <div className="analytics-page">
            <div className="page-header">
                <h1>{t('dashboard.analytics.title')}</h1>
                <p>{t('dashboard.analytics.subtitle')}</p>
            </div>

            {/* Progress ring + main stats */}
            <div className="analytics-top">
                <div className="glass-card analytics-completion">
                    <div className="completion-ring">
                        <svg viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                            <circle
                                cx="60" cy="60" r="50" fill="none"
                                stroke="url(#grad)" strokeWidth="10"
                                strokeLinecap="round"
                                strokeDasharray={`${completionRate * 3.14} ${314 - completionRate * 3.14}`}
                                transform="rotate(-90 60 60)"
                            />
                            <defs>
                                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#6366f1" />
                                    <stop offset="100%" stopColor="#8b5cf6" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="completion-text">
                            <span className="completion-value">{completionRate}%</span>
                            <span className="completion-label">{t('dashboard.analytics.completion')}</span>
                        </div>
                    </div>
                </div>

                <div className="glass-card analytics-status-bars">
                    <h3>{t('dashboard.analytics.byStatus')}</h3>
                    <div className="status-bars">
                        {[
                            { key: 'done', count: done, color: '#34d399' },
                            { key: 'progress', count: progress, color: '#6366f1' },
                            { key: 'review', count: review, color: '#fbbf24' },
                            { key: 'new', count: newTasks, color: '#94a3b8' },
                        ].map(s => (
                            <div key={s.key} className="status-bar-row">
                                <span className="status-bar-label">{t(`dashboard.status.${s.key}`)}</span>
                                <div className="status-bar-track">
                                    <div
                                        className="status-bar-fill"
                                        style={{
                                            width: `${total > 0 ? (s.count / total) * 100 : 0}%`,
                                            background: s.color,
                                        }}
                                    />
                                </div>
                                <span className="status-bar-count">{s.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Team performance + Priority */}
            <div className="analytics-grid">
                <div className="glass-card analytics-card">
                    <h3>{t('dashboard.analytics.teamPerformance')}</h3>
                    <div className="perf-list">
                        {assigneeStats.map(a => (
                            <div key={a.name} className="perf-item">
                                <div className="perf-member">
                                    <span className="perf-avatar">
                                        {a.avatar && a.avatar.includes('supabase') ? (
                                            <img src={a.avatar} alt={a.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            getInitials(a.name)
                                        )}
                                    </span>
                                    <span>{a.name}</span>
                                </div>
                                <div className="perf-bar-wrapper">
                                    <div className="perf-bar-track">
                                        <div
                                            className="perf-bar-fill"
                                            style={{ width: `${a.total > 0 ? (a.done / a.total) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <span className="perf-count">{a.done}/{a.total}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass-card analytics-card">
                    <h3>{t('dashboard.analytics.byPriority')}</h3>
                    <div className="priority-chart">
                        {[
                            { key: 'high', count: priorities.high, color: '#f87171', emoji: '🔴' },
                            { key: 'medium', count: priorities.medium, color: '#fbbf24', emoji: '🟡' },
                            { key: 'low', count: priorities.low, color: '#34d399', emoji: '🟢' },
                        ].map(p => (
                            <div key={p.key} className="priority-row">
                                <span className="priority-emoji">{p.emoji}</span>
                                <span className="priority-label">{t(`dashboard.priority.${p.key}`)}</span>
                                <div className="priority-bar-track">
                                    <div
                                        className="priority-bar-fill"
                                        style={{
                                            width: `${total > 0 ? (p.count / total) * 100 : 0}%`,
                                            background: p.color,
                                        }}
                                    />
                                </div>
                                <span className="priority-count">{p.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
