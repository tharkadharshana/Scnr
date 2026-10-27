import React from 'react';
import ToolsLayout from '../components/ToolsLayout';
import PricingPlans from '../components/PricingPlans';
import { loginWithGoogle } from '../supabase';
import { PRICING_FAQ } from '../lib/seo';
import '../pages/Landing.css';

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
