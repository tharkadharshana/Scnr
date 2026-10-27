import React from 'react';
import ToolsLayout from '../components/ToolsLayout';
import PricingPlans from '../components/PricingPlans';
import { loginWithGoogle } from '../supabase';
import { PRICING_FAQ } from '../lib/seo';
import { PLANS, PlanId, PlanLimits } from '../lib/plans';
import '../pages/Landing.css';

const COLS: PlanId[] = ['free', 'pro', 'team', 'business'];
const num = (n: number) => n.toLocaleString('en-US');
const history = (d: number) => (d >= 365 ? `${d / 365} year${d === 365 ? '' : 's'}` : `${d} days`);
const yes = (b: boolean) => (b ? '✓' : '—');

// Rows read straight from PLANS, so the table cannot drift from what the app enforces.
const ROWS: [string, (l: PlanLimits) => string][] = [
  ['QR codes in total', l => num(l.qr_codes)],
  ['Dynamic QR codes', l => num(l.dynamic_qr_codes)],
  ['Short links', l => num(l.short_links)],
  ['Hosted pages', l => num(l.pages)],
  ['Forms', l => num(l.forms)],
  ['Scans per month', l => num(l.monthly_scans)],
  ['Analytics history', l => history(l.analytics_days)],
  ['PIN, expiry, scan limits and Visitor Guard', l => yes(l.password_protect)],
  ['Custom back-halves for links', l => yes(l.custom_slug)],
  ['Smart routing and GPS tracking', l => yes(l.smart_routing)],
  ['No Scnr branding', l => yes(l.remove_branding)],
  ['Custom domains', l => num(l.custom_domains)],
  ['Team members', l => num(l.seats)],
  ['Workspaces', l => num(l.workspaces)],
  ['API, bulk create and CSV export', l => yes(l.api_access)],
  ['Webhooks', l => yes(l.webhooks)],
];

/** Plan comparison table. A real <table>, so screen readers and crawlers read each value with its plan and feature. */
function PlanTable() {
  return (
    <div className="cmp-wrap">
      <table className="cmp-table">
        <caption>Compare Scnr plans</caption>
        <thead>
          <tr>
            <th scope="col">Feature</th>
            {COLS.map(c => <th key={c} scope="col">{c[0].toUpperCase() + c.slice(1)}</th>)}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([label, f]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {COLS.map(c => {
                const v = f(PLANS[c]);
                return <td key={c}>{v === '—' ? <span aria-label="Not included">—</span> : v === '✓' ? <span aria-label="Included">✓</span> : v}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Public pricing page for logged-out visitors and search engines. Signed-in users get the in-app Pricing page at the same address. */
export default function PublicPricing() {
  return (
    <ToolsLayout>
      <PricingPlans
        onStart={() => { loginWithGoogle().catch(() => {}); }}
        header={<>
          <h1 className="hero-h1 tool-h1" style={{ textAlign: 'center' }}>Scnr pricing</h1>
          <p className="tool-intro" style={{ textAlign: 'center', margin: '0 auto' }}>Start free and upgrade when you need more codes, scans and statistics. Every plan lists its limits. Pay in rupees or US dollars. Pay yearly and get 2 months free.</p>
        </>}
      />
      <section className="faq-section" style={{ paddingTop: 56, paddingBottom: 0 }} aria-labelledby="cmp-h">
        <h2 className="section-h2" id="cmp-h">Compare the plans</h2>
        <PlanTable />
      </section>
      <section className="faq-section" style={{ paddingTop: 56 }} aria-labelledby="pricing-faq-h">
        <h2 className="section-h2" id="pricing-faq-h">Pricing questions</h2>
        <div className="faq-list">
          {PRICING_FAQ.map(f => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </ToolsLayout>
  );
}
