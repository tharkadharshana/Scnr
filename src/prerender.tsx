// Build-time entry for scripts/prerender.mjs: renders the public pages to an HTML string.
// Not part of the browser bundle. Keep this route list in step with the public routes in App.tsx.
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Tools from './pages/Tools';
import WhatsNew from './pages/WhatsNew';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsConditions from './pages/TermsConditions';
import RefundPolicy from './pages/RefundPolicy';

export function render(path: string): string {
  return renderToString(
    <StaticRouter location={path}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/legal/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/legal/terms-and-conditions" element={<TermsConditions />} />
        <Route path="/legal/refund-policy" element={<RefundPolicy />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/tools/:slug" element={<Tools />} />
        <Route path="/whats-new" element={<WhatsNew />} />
      </Routes>
    </StaticRouter>,
  );
}
