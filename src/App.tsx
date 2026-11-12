import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase, loginWithGoogle } from './supabase';
import { apiFetch } from './lib/api';
import { setShortDomain } from './lib/qrContent';
import Landing from './pages/Landing';

// Everything except the landing page is split into its own chunk, so logged-out
// visitors don't download recharts, qr-code-styling and the dashboard.
const DynamicQRLayout = lazy(() => import('./components/DynamicQRLayout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CreateQR = lazy(() => import('./pages/CreateQR'));
const Kit = lazy(() => import('./pages/Kit'));
const Pages = lazy(() => import('./pages/Pages'));
const Templates = lazy(() => import('./pages/Templates'));
const AdminTemplates = lazy(() => import('./pages/AdminTemplates'));
const AdminAiCosts = lazy(() => import('./pages/AdminAiCosts'));
const AdminCustomers = lazy(() => import('./pages/AdminCustomers'));
const TemplateEditor = lazy(() => import('./pages/PageEditor').then(m => ({ default: m.TemplateEditor })));
const PageEditor = lazy(() => import('./pages/PageEditor'));
const Forms = lazy(() => import('./pages/Forms'));
const FormResponses = lazy(() => import('./pages/Forms').then(m => ({ default: m.FormResponses })));
const FormEditor = lazy(() => import('./pages/FormEditor'));
const Bulk = lazy(() => import('./pages/Bulk'));
const ApiDocs = lazy(() => import('./pages/ApiDocs'));
const KitPrint = lazy(() => import('./pages/KitPrint'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Orders = lazy(() => import('./pages/Orders'));
const AccountAnalytics = lazy(() => import('./pages/AccountAnalytics'));
const Billing = lazy(() => import('./pages/Billing'));
const Pricing = lazy(() => import('./pages/Pricing'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsConditions = lazy(() => import('./pages/TermsConditions'));
const RefundPolicy = lazy(() => import('./pages/RefundPolicy'));
const Tools = lazy(() => import('./pages/Tools'));
const WhatsNew = lazy(() => import('./pages/WhatsNew'));
const PublicPricing = lazy(() => import('./pages/PublicPricing'));

const loadingScreen = <ShellSkeleton />;
// Signed-in (or returning from Google sign-in) visitors wait for the session behind skeleton boxes. Everyone else sees the page straight away instead of a spinner over the prerendered one.
// The prerendered page that came with the first load: shown while a lazy public page loads, so it does not flash blank.
const first = typeof document === 'undefined' ? null : { path: location.pathname, html: document.getElementById('prerender')?.innerHTML || '' };
const publicFallback = () => (first?.html && location.pathname === first.path ? <div dangerouslySetInnerHTML={{ __html: first.html }} /> : <div style={{ minHeight: '100dvh' }} />);
const mayHaveSession = () => {
  try { return document.documentElement.classList.contains('has-session') || /access_token|[?&]code=|error_description/.test(location.hash + location.search); } catch { return true; }
};

// Installed app (iOS home screen / Android PWA): logged-out users get a plain sign-in screen, never the marketing page.
const isStandalone = () => { try { return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true; } catch { return false; } };
function AppSignIn() {
  const [err, setErr] = useState('');
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <img src="/assets/icons/icon-192.png" alt="" width={72} height={72} style={{ borderRadius: 16 }} />
      <h1 style={{ fontSize: 24, margin: 0 }}>Scnr</h1>
      <p style={{ margin: 0, color: '#666' }}>Sign in or create your account.</p>
      <button onClick={() => { setErr(''); loginWithGoogle().catch(e => setErr(e?.message || 'Sign-in failed. Please try again.')); }}
        style={{ padding: '14px 28px', borderRadius: 10, border: 0, background: '#E85D3A', color: '#fff', fontSize: 16, fontWeight: 600 }}>Continue with Google</button>
      {err && <p style={{ margin: 0, color: '#991b1b', fontSize: 14 }}>{err}</p>}
    </div>
  );
}

import ErrorBoundary from './components/ErrorBoundary';
import CookieNotice from './components/CookieNotice';

import { UIProvider } from './shared/UIContext';
import { ShellSkeleton } from './components/Skeleton';

export default function App() {
  const [gate] = useState(mayHaveSession);
  const [user, setUser] = useState<any>(null);
  const [planData, setPlanData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes FIRST — this catches the OAuth callback
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        apiFetch('/api/user/plan')
          .then(d => { setShortDomain(d?.custom_domain); setPlanData(d); })
          .catch(err => console.error('Failed to fetch plan:', err));
      } else {
        setPlanData(null);
      }
    });

    // Also check existing session on mount (for page refreshes)
    // A stored session whose refresh failed (phone just woke, network not back yet) comes back null: retry before showing logged-out pages.
    const check = (left: number) => supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) return;
      if (gate && left > 0) { retry = setTimeout(() => check(left - 1), 2000); return; }
      setLoading(false);
    });
    let retry: ReturnType<typeof setTimeout>;
    check(3);

    // Safety timeout (longer when a stored session exists, so a slow wake-up does not look like a logout)
    const timer = setTimeout(() => {
      setLoading(false);
    }, gate ? 20000 : 8000);

    // Ask iOS/Android not to evict the stored session under storage pressure.
    navigator.storage?.persist?.().catch(() => {});

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
      clearTimeout(retry);
    };
  }, []);

  if (loading && gate) return loadingScreen;

  return (
    <ErrorBoundary>
      <UIProvider>
        <Router>
          <Suspense fallback={user ? loadingScreen : publicFallback()}>
          <Routes>
            {/* Public Legal Routes */}
            <Route path="/legal/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/legal/terms-and-conditions" element={<TermsConditions />} />
            <Route path="/legal/refund-policy" element={<RefundPolicy />} />

            {/* Public tools and release notes: no login */}
            <Route path="/tools" element={<Tools />} />
            <Route path="/tools/:slug" element={<Tools />} />
            <Route path="/whats-new" element={<WhatsNew />} />

            {user ? (
              <Route path="/" element={<DynamicQRLayout planData={planData} />}>
                <Route index element={<Dashboard />} />
                <Route path="create" element={<CreateQR key="create" />} />
                <Route path="kit" element={<Kit />} />
                <Route path="pages" element={<Templates />} />
                <Route path="pages/mine" element={<Pages />} />
                <Route path="admin/templates" element={<AdminTemplates />} />
                <Route path="admin/ai-costs" element={<AdminAiCosts />} />
                <Route path="admin/customers" element={<AdminCustomers />} />
                <Route path="admin/templates/new" element={<TemplateEditor />} />
                <Route path="admin/templates/:id/edit" element={<TemplateEditor />} />
                <Route path="pages/new" element={<PageEditor />} />
                <Route path="pages/:slug/edit" element={<PageEditor />} />
                <Route path="forms" element={<Forms />} />
                <Route path="forms/new" element={<FormEditor />} />
                <Route path="forms/:slug/edit" element={<FormEditor />} />
                <Route path="forms/:slug/responses" element={<FormResponses />} />
                <Route path="bulk" element={<Bulk />} />
                <Route path="api-docs" element={<ApiDocs />} />
                <Route path="kit/print/:slug" element={<KitPrint />} />
                <Route path="edit/:id" element={<CreateQR key="edit" />} />
                <Route path="analytics" element={<AccountAnalytics />} />
                <Route path="analytics/:slug" element={<Analytics />} />
                <Route path="analytics/:slug/orders" element={<Orders />} />
                <Route path="billing" element={<Billing />} />
                <Route path="pricing" element={<Pricing />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            ) : (
              <>
                <Route path="/" element={isStandalone() ? <AppSignIn /> : <Landing />} />
                <Route path="/login" element={isStandalone() ? <AppSignIn /> : <Landing />} />
                <Route path="/pricing" element={<PublicPricing />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
          </Suspense>
          <CookieNotice />
        </Router>
      </UIProvider>
    </ErrorBoundary>
  );
}