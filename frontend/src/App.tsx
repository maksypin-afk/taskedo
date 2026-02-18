import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DashboardLayout from './pages/DashboardPage';

// Lazy load dashboard pages
const OverviewPage = lazy(() => import('./pages/dashboard/OverviewPage'));
const KanbanPage = lazy(() => import('./pages/dashboard/KanbanPage'));
const CalendarPage = lazy(() => import('./pages/dashboard/CalendarPage'));
const TeamPage = lazy(() => import('./pages/dashboard/TeamPage'));
const AnalyticsPage = lazy(() => import('./pages/dashboard/AnalyticsPage'));
const ProfilePage = lazy(() => import('./pages/dashboard/ProfilePage'));
const GeofencePage = lazy(() => import('./pages/dashboard/GeofencePage'));

// Loading component
const PageLoader = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
        Loading...
    </div>
);

function App() {
    return (
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={
                    <Suspense fallback={<PageLoader />}>
                        <OverviewPage />
                    </Suspense>
                } />
                <Route path="tasks" element={
                    <Suspense fallback={<PageLoader />}>
                        <KanbanPage />
                    </Suspense>
                } />
                <Route path="calendar" element={
                    <Suspense fallback={<PageLoader />}>
                        <CalendarPage />
                    </Suspense>
                } />
                <Route path="team" element={
                    <Suspense fallback={<PageLoader />}>
                        <TeamPage />
                    </Suspense>
                } />
                <Route path="analytics" element={
                    <Suspense fallback={<PageLoader />}>
                        <AnalyticsPage />
                    </Suspense>
                } />
                <Route path="profile" element={
                    <Suspense fallback={<PageLoader />}>
                        <ProfilePage />
                    </Suspense>
                } />
                <Route path="geofence" element={
                    <Suspense fallback={<PageLoader />}>
                        <GeofencePage />
                    </Suspense>
                } />
            </Route>
        </Routes>
    );
}

export default App;
