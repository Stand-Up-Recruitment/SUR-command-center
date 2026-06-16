import { useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { LoginGate } from './components/auth/LoginGate';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Header } from './components/layout/Header';
import { OverviewPage } from './pages/OverviewPage';
import { MarketingPage } from './pages/MarketingPage';
import { SalesPage } from './pages/SalesPage';
import { RecruitmentPage } from './pages/RecruitmentPage';
import { RevenuePage } from './pages/RevenuePage';
import { FinancePage } from './pages/FinancePage';
import { RetentionPage } from './pages/RetentionPage';

const IS_DEMO =
  !import.meta.env.VITE_AIRTABLE_API_KEY ||
  !import.meta.env.VITE_AIRTABLE_BASE_ID;

export default function App() {
  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <LoginGate>
    <div style={{ background: '#0d0d0d', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header onRefresh={handleRefresh} isDemo={IS_DEMO} />
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <Routes>
          <Route path="/"            element={<OverviewPage />} />
          <Route path="/marketing"   element={<MarketingPage />} />
          <Route path="/sales"       element={<SalesPage />} />
          <Route path="/recruitment" element={<RecruitmentPage />} />
          <Route path="/revenue"     element={<RevenuePage />} />
          <Route path="/finance"     element={<FinancePage />} />
          <Route path="/retention"   element={<RetentionPage />} />
        </Routes>
      </main>
      <Analytics />
      <SpeedInsights />
    </div>
    </LoginGate>
  );
}
