import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/landing.css';

const LANGUAGES = [
    { code: 'ru', label: 'RU' },
    { code: 'kg', label: 'KG' },
    { code: 'en', label: 'EN' },
] as const;

export default function LandingPage() {
    const { t, i18n } = useTranslation();
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const changeLang = (lng: string) => {
        i18n.changeLanguage(lng);
        localStorage.setItem('taskedo-lang', lng);
    };

    const scrollTo = (id: string) => {
        setMobileOpen(false);
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <>
            {/* ===== NAVBAR ===== */}
            <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
                <div className="container navbar-inner">
                    <div className="navbar-logo">
                        <div className="logo-icon">T</div>
                        Taskedo
                    </div>

                    <div className="navbar-links">
                        <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>
                            {t('nav.features')}
                        </a>
                        <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo('pricing'); }}>
                            {t('nav.pricing')}
                        </a>
                    </div>

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

                    <div className="navbar-actions">
                        <a href="/auth" className="btn btn-primary">{t('nav.join')}</a>

                        <button
                            className="mobile-menu-btn"
                            onClick={() => setMobileOpen(true)}
                            aria-label="Menu"
                        >
                            <span />
                            <span />
                            <span />
                        </button>
                    </div>
                </div>
            </nav>

            {/* ===== MOBILE NAV ===== */}
            <div className={`mobile-nav ${mobileOpen ? 'open' : ''}`}>
                <button className="mobile-nav-close" onClick={() => setMobileOpen(false)}>✕</button>
                <div className="lang-switcher" style={{ marginBottom: '1rem' }}>
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
                <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>
                    {t('nav.features')}
                </a>
                <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo('pricing'); }}>
                    {t('nav.pricing')}
                </a>
                <a href="/auth" className="btn btn-primary btn-lg">{t('nav.join')}</a>
            </div>

            {/* ===== HERO ===== */}
            <section className="hero">
                <div className="hero-bg">
                    <div className="hero-grid" />
                </div>
                <div className="container hero-content">
                    <div className="hero-badge animate-fade-in-up">
                        <span className="dot" />
                        Taskedo v1.0
                    </div>
                    <h1 className="hero-title animate-fade-in-up animate-delay-1">
                        {t('hero.title')}
                        <br />
                        <span className="accent">{t('hero.titleAccent')}</span>
                    </h1>
                    <p className="hero-subtitle animate-fade-in-up animate-delay-2">
                        {t('hero.subtitle')}
                    </p>
                    <div className="hero-actions animate-fade-in-up animate-delay-3">
                        <a href="/auth" className="btn btn-primary btn-lg">{t('hero.cta')}</a>
                        <a href="#features" className="btn btn-outline btn-lg" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>
                            {t('nav.features')}
                        </a>
                    </div>
                    <p className="hero-sub animate-fade-in-up animate-delay-4">
                        {t('hero.ctaSub')}
                    </p>
                </div>
            </section>

            {/* ===== FEATURES ===== */}
            <section className="features" id="features">
                <div className="container">
                    <div className="section-header">
                        <h2>{t('features.sectionTitle')}</h2>
                        <p>{t('features.sectionSubtitle')}</p>
                    </div>
                    <div className="features-grid">
                        {(['kanban', 'calendar', 'team', 'dashboard'] as const).map((key, i) => (
                            <div
                                key={key}
                                className={`glass-card feature-card animate-fade-in-up animate-delay-${i + 1}`}
                            >
                                <div className="feature-icon">
                                    {key === 'kanban' && '📋'}
                                    {key === 'calendar' && '📅'}
                                    {key === 'team' && '👥'}
                                    {key === 'dashboard' && '📊'}
                                </div>
                                <h3>{t(`features.${key}.title`)}</h3>
                                <p>{t(`features.${key}.desc`)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===== PRICING ===== */}
            <section className="pricing" id="pricing">
                <div className="container">
                    <div className="section-header">
                        <h2>{t('pricing.sectionTitle')}</h2>
                        <p>{t('pricing.sectionSubtitle')}</p>
                    </div>
                    <div className="pricing-grid">
                        {(['start', 'growth', 'pro'] as const).map((plan) => (
                            <div
                                key={plan}
                                className={`glass-card pricing-card ${plan === 'growth' ? 'featured' : ''}`}
                            >
                                <div className="pricing-name">{t(`pricing.plans.${plan}.name`)}</div>
                                <div className="pricing-desc">{t(`pricing.plans.${plan}.desc`)}</div>
                                <div className="pricing-price">
                                    {t(`pricing.plans.${plan}.price`)}
                                    {plan !== 'start' && (
                                        <span className="period"> / {t('pricing.monthly')}</span>
                                    )}
                                </div>
                                <ul className="pricing-features">
                                    <li>{t(`pricing.plans.${plan}.f1`)}</li>
                                    <li>{t(`pricing.plans.${plan}.f2`)}</li>
                                    <li>{t(`pricing.plans.${plan}.f3`)}</li>
                                </ul>
                                <a href="/auth" className={`btn ${plan === 'growth' ? 'btn-primary' : 'btn-outline'}`}>
                                    {t('pricing.choosePlan')}
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===== MOBILE APP ===== */}
            <section className="mobile-app">
                <div className="container">
                    <div className="mobile-app-inner glass-card">
                        <div className="mobile-app-icon">📱</div>
                        <h2>{t('mobileApp.title')}</h2>
                        <p>{t('mobileApp.subtitle')}</p>
                        <div className="store-buttons">
                            <a
                                href="https://play.google.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="store-btn google-play"
                            >
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                    <path d="M3.609 1.814 13.792 12 3.609 22.186a.996.996 0 0 1-.609-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893 2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.414-2.492 2.492L12.714 12l2.492-2.492 3.182 1.841a1 1 0 0 1 0 1.738l-.69.206zM5.864 2.658l10.937 6.333-2.302 2.302L5.864 2.658z" />
                                </svg>
                                <div className="store-btn-text">
                                    <span className="store-btn-label">GET IT ON</span>
                                    <span className="store-btn-name">{t('mobileApp.googlePlay')}</span>
                                </div>
                            </a>
                            <a
                                href="https://apps.apple.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="store-btn app-store"
                            >
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                                </svg>
                                <div className="store-btn-text">
                                    <span className="store-btn-label">Download on the</span>
                                    <span className="store-btn-name">{t('mobileApp.appStore')}</span>
                                </div>
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== FOOTER ===== */}
            <footer className="footer">
                <div className="container">
                    <div className="footer-grid">
                        <div className="footer-brand">
                            <div className="navbar-logo">
                                <div className="logo-icon">T</div>
                                Taskedo
                            </div>
                            <p>{t('footer.desc')}</p>
                        </div>
                        <div className="footer-col">
                            <h4>{t('footer.product')}</h4>
                            <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>
                                {t('nav.features')}
                            </a>
                            <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo('pricing'); }}>
                                {t('nav.pricing')}
                            </a>
                            <a href="#">{t('footer.docs')}</a>
                        </div>
                        <div className="footer-col">
                            <h4>{t('footer.company')}</h4>
                            <a href="#">{t('nav.about')}</a>
                            <a href="#">{t('footer.contact')}</a>
                        </div>
                        <div className="footer-col">
                            <h4>{t('footer.support')}</h4>
                            <a href="#">{t('footer.privacy')}</a>
                            <a href="#">{t('footer.terms')}</a>
                        </div>
                    </div>
                    <div className="footer-bottom">
                        {t('footer.rights')}
                    </div>
                </div>
            </footer>
        </>
    );
}
