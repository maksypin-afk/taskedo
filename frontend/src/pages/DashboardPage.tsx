import { useEffect, useState, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { fetchProfile, type DbProfile } from '../lib/profileService';
import { ensureUserInTeam, getPendingInvites, acceptInvite, declineInvite } from '../lib/teamService';
import type { User } from '@supabase/supabase-js';
import { getInitials } from '../lib/utils';
import { fetchNotifications, markAsRead, markAllAsRead, deleteNotification, type DbNotification } from '../lib/notificationService';
import { createOrganization } from '../lib/organizationService';
import { OrgProvider, useOrg } from '../lib/OrgContext';
import '../styles/dashboard.css';

const LANGUAGES = [
    { code: 'ru', label: 'RU' },
    { code: 'kg', label: 'KG' },
    { code: 'en', label: 'EN' },
] as const;

function DashboardInner() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<DbProfile | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [initialized, setInitialized] = useState(false);
    const [notifications, setNotifications] = useState<DbNotification[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showOrgSwitcher, setShowOrgSwitcher] = useState(false);



    const { activeOrgId, activeOrgName, userOrgs, switchOrg, refreshOrgs, loading: orgsLoading } = useOrg();
    const creationAttempted = useRef(false);

    useEffect(() => {
        supabase.auth.getUser().then(async ({ data }) => {
            if (!data.user) {
                navigate('/auth');
            } else {
                setUser(data.user);
                try {
                    const profileData = await fetchProfile();
                    setProfile(profileData);
                    if (profileData?.organization_id) {
                        await ensureUserInTeam();
                    }
                } catch (err) {
                    console.error('Init error:', err);
                }
                setInitialized(true);
                fetchNotifications().then(setNotifications);
            }
        });
    }, [navigate]);

    // Auto-create Personal Workspace if no orgs exist
    useEffect(() => {
        const initPersonalWorkspace = async () => {
            // Only proceed if initialization is done AND orgs are fully loaded
            if (initialized && !orgsLoading && userOrgs.length === 0 && user && !creationAttempted.current) {
                creationAttempted.current = true; // Lock immediately
                try {
                    console.log('No organizations found. Creating Personal Workspace...');
                    const newOrg = await createOrganization({
                        name: 'Personal Workspace',
                        industry: 'Personal'
                    });
                    await refreshOrgs();
                    switchOrg(newOrg.id);
                } catch (err) {
                    console.error('Failed to create personal workspace:', err);
                    creationAttempted.current = false; // Unlock on error
                }
            }
        };
        initPersonalWorkspace();
    }, [initialized, orgsLoading, userOrgs.length, user, refreshOrgs, switchOrg]);

    const handleMarkAllRead = async () => {
        try {
            await markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    };

    const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await deleteNotification(id);
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (err) {
            console.error('Failed to delete notification:', err);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/auth');
    };

    const changeLang = (lng: string) => {
        i18n.changeLanguage(lng);
        localStorage.setItem('taskedo-lang', lng);
    };

    const handleSwitchOrg = (orgId: string) => {
        switchOrg(orgId);
        setShowOrgSwitcher(false);
    };

    const navItems = [
        { to: '/dashboard', icon: '🏠', label: t('dashboard.nav.overview'), end: true },
        { to: '/dashboard/tasks', icon: '📋', label: t('dashboard.nav.tasks'), end: false },
        { to: '/dashboard/calendar', icon: '📅', label: t('dashboard.nav.calendar'), end: false },
        { to: '/dashboard/team', icon: '👥', label: t('dashboard.nav.team'), end: false },
        { to: '/dashboard/analytics', icon: '📊', label: t('dashboard.nav.analytics'), end: false },
        { to: '/dashboard/profile', icon: '⚙️', label: t('dashboard.nav.profile'), end: false },
    ];

    const currentOrg = userOrgs.find(o => o.id === activeOrgId);

    // Add geofence nav only for owners, but NOT for Personal Workspace
    if (currentOrg?.role === 'owner' && currentOrg?.industry !== 'Personal') {
        navItems.push({ to: '/dashboard/geofence', icon: '📍', label: t('dashboard.nav.geofence'), end: false });
    }

    // Pending Invites Logic
    const [pendingInvites, setPendingInvites] = useState<any[]>([]);

    useEffect(() => {
        if (user) {
            getPendingInvites().then(setPendingInvites);
        }
    }, [user]);

    const handleAcceptInvite = async (invite: any) => {
        try {
            await acceptInvite(invite.id, invite.organization.id);
            setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
            await refreshOrgs();
            // Optional: Switch to new org?
            switchOrg(invite.organization.id);
        } catch (err) {
            console.error('Failed to accept invite:', err);
            alert('Failed to join organization. Please try again.');
        }
    };

    const handleDeclineInvite = async (inviteId: string) => {
        if (!window.confirm(t('dashboard.team.confirmDecline') || 'Are you sure you want to decline this invitation?')) return;
        try {
            await declineInvite(inviteId);
            setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
        } catch (err) {
            console.error('Failed to decline invite:', err);
            alert('Failed to decline invitation.');
        }
    };

    return (
        <div className={`dashboard-layout ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
            {/* Sidebar */}
            <aside className="sidebar">
                {/* Org switcher header */}
                <div className="sidebar-header" style={{ position: 'relative' }}>
                    <button
                        className="navbar-logo"
                        onClick={() => userOrgs.length > 1 && setShowOrgSwitcher(!showOrgSwitcher)}
                        style={{ cursor: userOrgs.length > 1 ? 'pointer' : 'default', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', width: '100%', padding: 0, color: 'inherit' }}
                    >
                        <div className="logo-icon" style={{ background: currentOrg?.role === 'owner' ? 'linear-gradient(135deg, var(--color-accent), #8b5cf6)' : 'linear-gradient(135deg, #34d399, #06b6d4)' }}>
                            {activeOrgName?.[0]?.toUpperCase() || 'T'}
                        </div>
                        <span className="sidebar-text" style={{ flex: 1, textAlign: 'left', fontSize: '0.9rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {activeOrgName || 'Taskedo'}
                        </span>
                        {userOrgs.length > 1 && (
                            <span className="sidebar-text" style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', transform: showOrgSwitcher ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                        )}
                    </button>
                    <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        {sidebarOpen ? '◀' : '▶'}
                    </button>

                    {/* Org dropdown */}
                    {showOrgSwitcher && (
                        <div style={{
                            position: 'absolute', top: '100%', left: 'var(--spacing-md)', right: 'var(--spacing-md)',
                            background: '#111827', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 200, overflow: 'hidden',
                        }}>
                            <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)' }}>
                                {t('dashboard.myOrganizations')}
                            </div>
                            {userOrgs.map(org => (
                                <button
                                    key={org.id}
                                    onClick={(e) => {
                                        console.log('Sidebar clicked org:', org.id, org.name);
                                        e.preventDefault();
                                        handleSwitchOrg(org.id);
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%',
                                        padding: '0.6rem 0.75rem', background: org.id === activeOrgId ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                        border: 'none', cursor: 'pointer', color: 'var(--color-text)', fontSize: '0.85rem',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => { if (org.id !== activeOrgId) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                    onMouseLeave={e => { if (org.id !== activeOrgId) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <div style={{
                                        width: '28px', height: '28px', borderRadius: 'var(--radius-md)', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'white', flexShrink: 0,
                                        background: org.role === 'owner' ? 'linear-gradient(135deg, var(--color-accent), #8b5cf6)' : 'linear-gradient(135deg, #34d399, #06b6d4)',
                                    }}>
                                        {org.name[0]?.toUpperCase() || '?'}
                                    </div>
                                    <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                                            {org.role === 'owner' ? t('dashboard.orgOwner') : t('dashboard.orgMember')}
                                        </div>
                                    </div>
                                    {org.id === activeOrgId && (
                                        <span style={{ color: 'var(--color-accent)', fontSize: '0.9rem' }}>✓</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                            onClick={() => { if (window.innerWidth <= 768) setSidebarOpen(true); }}
                        >
                            <span className="sidebar-icon">{item.icon}</span>
                            <span className="sidebar-label sidebar-text">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="lang-switcher sidebar-lang sidebar-text">
                        {LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                className={`lang-btn ${i18n.language === lang.code ? 'active' : ''}`}
                                onClick={() => changeLang(lang.code)}
                            >
                                {lang.label}
                            </button>
                        ))}
                    </div>
                </div>
            </aside>

            {/* Mobile sidebar overlay backdrop */}
            {!sidebarOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setSidebarOpen(true)}
                />
            )}

            {/* Main content */}
            <div className="dashboard-main-area">
                <header className="topbar">
                    <button className="topbar-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        <span /><span /><span />
                    </button>
                    <div className="topbar-spacer" />
                    <div className="topbar-actions">
                        {activeOrgId && (
                            <div className="topbar-notifications">
                                <button className="topbar-notif-btn" onClick={() => setShowNotifications(!showNotifications)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                                    {notifications.filter(n => !n.read).length > 0 && (
                                        <span className="notif-badge">{notifications.filter(n => !n.read).length}</span>
                                    )}
                                </button>
                                {showNotifications && (
                                    <div className="notifications-dropdown glass-card">
                                        <div className="notif-header">
                                            <h4>{t('dashboard.notifications.title')}</h4>
                                            <button onClick={handleMarkAllRead}>{t('dashboard.notifications.markAllRead')}</button>
                                        </div>
                                        <div className="notif-list">
                                            {notifications.length === 0 ? (
                                                <p className="notif-empty">{t('dashboard.notifications.empty')}</p>
                                            ) : (
                                                notifications.map(n => (
                                                    <div key={n.id} className={`notif-item ${n.read ? 'read' : 'unread'}`} onClick={() => markAsRead(n.id).then(() => setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item)))}>
                                                        <div className="notif-content">
                                                            <strong>{n.title}</strong>
                                                            <p>{n.message}</p>
                                                            <span className="notif-time">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                        <button className="notif-delete" onClick={(e) => handleDeleteNotification(n.id, e)}>✕</button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="topbar-user">
                            <div className="topbar-avatar">
                                {getInitials(profile?.display_name || user?.email?.split('@')[0] || '')}
                            </div>
                            <span className="topbar-user-name">
                                {profile?.display_name || user?.email?.split('@')[0] || ''}
                            </span>
                        </div>
                        <button className="btn btn-outline btn-sm" onClick={handleLogout}>
                            {t('dashboard.logout')}
                        </button>
                    </div>
                </header>

                <main className="dashboard-content">
                    {/* Pending Invites Banner */}
                    {pendingInvites.length > 0 && (
                        <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {pendingInvites.map(invite => (
                                <div key={invite.id} className="glass-card animate-fade-in-up" style={{
                                    padding: '1rem 1.5rem',
                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                    background: 'rgba(99, 102, 241, 0.05)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ fontSize: '1.5rem' }}>👋</div>
                                        <div>
                                            <strong style={{ fontSize: '1rem', display: 'block' }}>{t('dashboard.team.inviteTitle', { org: invite.organization?.name || 'Organization' }) || `You have been invited to join ${invite.organization?.name}`}</strong>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{t('dashboard.team.role')}: {invite.role}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button
                                            onClick={() => handleAcceptInvite(invite)}
                                            className="btn btn-primary"
                                            style={{ padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}
                                        >
                                            {t('dashboard.team.accept') || 'Accept'}
                                        </button>
                                        <button
                                            onClick={() => handleDeclineInvite(invite.id)}
                                            style={{
                                                padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                                                color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.9rem'
                                            }}
                                        >
                                            {t('dashboard.team.decline') || 'Decline'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {initialized ? (
                        <Outlet />
                    ) : (
                        <div className="kanban-loading">{t('auth.loading')}</div>
                    )}
                </main>
            </div>

            {/* Close dropdown on outside click */}
            {showOrgSwitcher && (
                <div
                    style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                    onClick={() => setShowOrgSwitcher(false)}
                />
            )}
        </div>
    );
}

export default function DashboardLayout() {
    return (
        <OrgProvider>
            <DashboardInner />
        </OrgProvider>
    );
}
