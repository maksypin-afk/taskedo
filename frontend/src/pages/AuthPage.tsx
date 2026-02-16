import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import '../styles/auth.css';

const LANGUAGES = [
    { code: 'ru', label: 'RU' },
    { code: 'kg', label: 'KG' },
    { code: 'en', label: 'EN' },
] as const;

export default function AuthPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const changeLang = (lng: string) => {
        i18n.changeLanguage(lng);
        localStorage.setItem('taskedo-lang', lng);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else {
                // Validate passwords match
                if (password !== confirmPassword) {
                    throw new Error(t('auth.passwordsDoNotMatch'));
                }
                if (password.length < 6) {
                    throw new Error(t('auth.passwordTooShort'));
                }

                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: name,
                        }
                    },
                });
                if (error) throw error;
            }
            navigate('/dashboard');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) setError(error.message);
    };

    return (
        <div className="auth-page">
            {/* Background effects */}
            <div className="auth-bg">
                <div className="auth-bg-orb auth-bg-orb-1" />
                <div className="auth-bg-orb auth-bg-orb-2" />
                <div className="auth-bg-grid" />
            </div>

            {/* Language switcher */}
            <div className="auth-lang">
                <div className="lang-switcher">
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

            {/* Auth card */}
            <div className="auth-container">
                <Link to="/" className="auth-logo">
                    <div className="logo-icon">T</div>
                    Taskedo
                </Link>

                <div className="auth-card glass-card">
                    {/* Tab switcher */}
                    <div className="auth-tabs">
                        <button
                            className={`auth-tab ${isLogin ? 'active' : ''}`}
                            onClick={() => { setIsLogin(true); setError(''); }}
                        >
                            {t('auth.login')}
                        </button>
                        <button
                            className={`auth-tab ${!isLogin ? 'active' : ''}`}
                            onClick={() => { setIsLogin(false); setError(''); }}
                        >
                            {t('auth.signup')}
                        </button>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="auth-error animate-fade-in-up">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="auth-form">
                        {/* Full name field (signup only) */}
                        {!isLogin && (
                            <div className="form-group animate-fade-in-up">
                                <label htmlFor="name">{t('auth.name')}</label>
                                <div className="input-wrapper">
                                    <svg className="input-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                    <input
                                        id="name"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder={t('auth.namePlaceholder')}
                                        autoComplete="name"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {/* Email field */}
                        <div className="form-group">
                            <label htmlFor="email">{t('auth.email')}</label>
                            <div className="input-wrapper">
                                <svg className="input-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="2" y="4" width="20" height="16" rx="2" />
                                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                </svg>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={t('auth.emailPlaceholder')}
                                    autoComplete="email"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password field */}
                        <div className="form-group">
                            <div className="form-label-row">
                                <label htmlFor="password">{t('auth.password')}</label>
                                {isLogin && (
                                    <a href="#" className="form-link">{t('auth.forgotPassword')}</a>
                                )}
                            </div>
                            <div className="input-wrapper">
                                <svg className="input-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={t('auth.passwordPlaceholder')}
                                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label="Toggle password"
                                >
                                    {showPassword ? (
                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Confirm password field (signup only) */}
                        {!isLogin && (
                            <div className="form-group animate-fade-in-up">
                                <label htmlFor="confirmPassword">{t('auth.confirmPassword')}</label>
                                <div className="input-wrapper">
                                    <svg className="input-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    <input
                                        id="confirmPassword"
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder={t('auth.confirmPasswordPlaceholder')}
                                        autoComplete="new-password"
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary btn-lg auth-submit"
                            disabled={loading}
                        >
                            {loading ? t('auth.loading') : isLogin ? t('auth.loginBtn') : t('auth.signupBtn')}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="auth-divider">
                        <span>{t('auth.or')}</span>
                    </div>

                    {/* Social login */}
                    <div className="social-buttons">
                        <button className="social-btn" type="button" onClick={handleGoogleLogin}>
                            <svg viewBox="0 0 24 24" width="20" height="20">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Google
                        </button>
                    </div>

                    {/* Switch mode text */}
                    <p className="auth-switch">
                        {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}{' '}
                        <button type="button" className="auth-switch-btn" onClick={() => { setIsLogin(!isLogin); setError(''); }}>
                            {isLogin ? t('auth.signup') : t('auth.login')}
                        </button>
                    </p>
                </div>

                <p className="auth-terms">
                    {t('auth.agreePrefix')}{' '}
                    <a href="#">{t('auth.termsLink')}</a>{' '}
                    {t('auth.and')}{' '}
                    <a href="#">{t('auth.privacyLink')}</a>
                </p>
            </div>
        </div>
    );
}
