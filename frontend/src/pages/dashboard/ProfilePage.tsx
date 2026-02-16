import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchProfile, updateProfile, getUserEmail } from '../../lib/profileService';
import { useOrg } from '../../lib/OrgContext';
import { supabase } from '../../lib/supabase';
import type { DbProfile } from '../../lib/profileService';
import { getInitials } from '../../lib/utils';

export default function ProfilePage() {
    const { t } = useTranslation();
    const { activeOrgId } = useOrg();
    const [profile, setProfile] = useState<DbProfile | null>(null);
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const [displayName, setDisplayName] = useState('');
    const [birthday, setBirthday] = useState('');
    const [phone, setPhone] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [telegram, setTelegram] = useState('');

    useEffect(() => {
        Promise.all([fetchProfile(), getUserEmail()])
            .then(([p, e]) => {
                setProfile(p);
                setEmail(e);
                if (p) {
                    setDisplayName(p.display_name || '');
                    setBirthday(p.birthday || '');
                    setPhone(p.phone || '');
                    setWhatsapp(p.whatsapp || '');
                    setTelegram(p.telegram || '');
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);


    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setSaved(false);
        try {
            const updated = await updateProfile({
                display_name: displayName,
                birthday: birthday || null,
                phone,
                whatsapp: whatsapp || null,
                telegram: telegram || null,
            });

            // Sync with team_members as well
            // Sync with team_members as well
            if (activeOrgId) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase
                        .from('team_members')
                        .update({ name: displayName })
                        .eq('user_id', user.id)
                        .eq('organization_id', activeOrgId);
                }
            }

            setProfile(updated);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error('Failed to update profile:', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="profile-page">
                <div className="page-header">
                    <h1>{t('dashboard.profile.title')}</h1>
                    <p>{t('dashboard.profile.subtitle')}</p>
                </div>
                <div className="kanban-loading">{t('auth.loading')}</div>
            </div>
        );
    }

    const initials = getInitials(displayName || email.split('@')[0]);

    return (
        <div className="profile-page">
            <div className="page-header">
                <h1>{t('dashboard.profile.title')}</h1>
                <p>{t('dashboard.profile.subtitle')}</p>
            </div>

            <div className="glass-card profile-avatar-card">
                <div
                    className="profile-avatar-large"
                >
                    {initials}
                </div>
                <h2>{displayName || email}</h2>
                <p className="profile-email">{email}</p>
                {profile?.created_at && (
                    <p className="profile-joined">
                        {t('dashboard.profile.joined')}: {new Date(profile.created_at).toLocaleDateString()}
                    </p>
                )}
            </div>

            {/* Settings form */}
            <form className="glass-card profile-form" onSubmit={handleSave}>
                <h3>{t('dashboard.profile.personalInfo')}</h3>

                <div className="profile-form-grid">
                    <div className="profile-field">
                        <label>{t('dashboard.profile.displayName')}</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            className="kanban-input"
                            placeholder={t('dashboard.team.namePlaceholder')}
                        />
                    </div>

                    <div className="profile-field">
                        <label>{t('dashboard.profile.email')}</label>
                        <input
                            type="email"
                            value={email}
                            className="kanban-input"
                            disabled
                            style={{ opacity: 0.5 }}
                        />
                    </div>

                    <div className="profile-field">
                        <label>{t('dashboard.profile.birthday')}</label>
                        <input
                            type="date"
                            value={birthday}
                            onChange={e => setBirthday(e.target.value)}
                            className="kanban-input kanban-date-input"
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>

                    <div className="profile-field">
                        <label>{t('dashboard.profile.phone')}</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            className="kanban-input"
                        />
                    </div>

                    <div className="profile-field">
                        <label>{t('profile.whatsapp')}</label>
                        <input
                            type="text"
                            value={whatsapp}
                            onChange={e => setWhatsapp(e.target.value)}
                            className="kanban-input"
                            placeholder="https://wa.me/..."
                        />
                    </div>

                    <div className="profile-field">
                        <label>{t('profile.telegram')}</label>
                        <input
                            type="text"
                            value={telegram}
                            onChange={e => setTelegram(e.target.value)}
                            className="kanban-input"
                            placeholder="https://t.me/..."
                        />
                    </div>

                    {/* Organization field removed from profile settings as it's managed via switcher/team page */}
                </div>

                <div className="profile-form-footer">
                    {saved && (
                        <span className="profile-saved animate-fade-in-up">
                            ✅ {t('dashboard.profile.saved')}
                        </span>
                    )}
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={saving}
                    >
                        {saving ? t('auth.loading') : t('dashboard.profile.save')}
                    </button>
                </div>
            </form>



            {/* Change Password Section */}
            <div className="glass-card profile-form" style={{ marginTop: '2rem' }}>
                <h3>{t('profile.changePasswordTitle')}</h3>
                <form
                    onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const newPassword = (form.elements.namedItem('newPassword') as HTMLInputElement).value;
                        const confirmPassword = (form.elements.namedItem('confirmPassword') as HTMLInputElement).value;

                        if (newPassword !== confirmPassword) {
                            alert(t('auth.passwordsDoNotMatch'));
                            return;
                        }

                        if (newPassword.length < 6) {
                            alert(t('auth.passwordTooShort'));
                            return;
                        }

                        try {
                            setLoading(true);
                            const { error } = await supabase.auth.updateUser({ password: newPassword });
                            if (error) throw error;
                            alert(t('profile.passwordUpdated'));
                            (form as HTMLFormElement).reset();
                        } catch (err: any) {
                            alert(err.message);
                        } finally {
                            setLoading(false);
                        }
                    }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                >
                    <div className="profile-field">
                        <label>{t('profile.newPassword')}</label>
                        <input
                            name="newPassword"
                            type="password"
                            placeholder="******"
                            className="kanban-input"
                            required
                            minLength={6}
                        />
                    </div>
                    <div className="profile-field">
                        <label>{t('profile.confirmPassword')}</label>
                        <input
                            name="confirmPassword"
                            type="password"
                            placeholder="******"
                            className="kanban-input"
                            required
                            minLength={6}
                        />
                    </div>
                    <button type="submit" className="btn btn-outline" style={{ alignSelf: 'flex-start' }}>
                        {t('profile.updatePassword')}
                    </button>
                </form>
            </div>
        </div>
    );
}
