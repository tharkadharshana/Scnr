import React, { useState } from 'react';
import { formatPrice, planFeatures, PAID_PLANS, Currency, PaidPlan } from '../lib/plans';

const defaultCurrency = (): Currency => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Colombo' ? 'LKR' : 'USD'; } catch { return 'LKR'; }
};

/** Currency switch, plan cards and the payment note, shared by the home page and the public /pricing page. Prices come from plans.ts. */
/** `reveal` fades the cards in on scroll; only the home page runs the observer that needs. */
export default function PricingPlans({ header, onStart, reveal }: { header: React.ReactNode; onStart: () => void; reveal?: boolean }) {
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const price = (plan: PaidPlan) => {
    const p = formatPrice(plan, currency, 'monthly');
    return currency === 'USD' ? p.replace('$', '') : p.replace('LKR ', '');
  };
  return (
    <>
      <div className="pricing-header">
        {header}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '18px' }} role="group" aria-label="Currency">
          {(['LKR', 'USD'] as Currency[]).map(c => (
            <button key={c} className={`btn-plan ${currency === c ? 'filled' : 'outline'}`} style={{ width: 'auto', padding: '8px 18px' }} aria-pressed={currency === c} onClick={() => setCurrency(c)}>{c}</button>
          ))}
        </div>
      </div>
      <div className={`pricing-grid${reveal ? ' reveal' : ''}`}>
        <div className="plan">
          <div className="plan-tier">Free</div>
          <div className="plan-price"><sup>{currency === 'USD' ? '$' : 'LKR '}</sup>0</div>
          <div className="plan-cycle">forever · no card needed</div>
          <div className="plan-divider"></div>
          <ul className="plan-feats">
            {planFeatures('free').map(f => <li key={f}><span className="pf-check">✓</span> {f}</li>)}
          </ul>
          <button className="btn-plan outline" onClick={onStart}>Create a free code</button>
        </div>
        {PAID_PLANS.map(p => (
          <div key={p} className={`plan${p === 'pro' ? ' featured' : ''}`}>
            {p === 'pro' && <div className="plan-badge">For one business</div>}
            <div className="plan-tier">{p.charAt(0).toUpperCase() + p.slice(1)}</div>
            <div className="plan-price"><sup>{currency === 'USD' ? '$' : 'LKR '}</sup>{price(p)}</div>
            <div className="plan-cycle">per month · {formatPrice(p, currency, 'annual')} / year</div>
            <div className="plan-divider"></div>
            <ul className="plan-feats">
              {planFeatures(p).map(f => <li key={f}><span className="pf-check">✓</span> {f}</li>)}
            </ul>
            <button className={`btn-plan ${p === 'pro' ? 'filled' : 'outline'}`} onClick={onStart}>Start 14-day trial</button>
          </div>
        ))}
      </div>
      <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--ink3)', marginTop: '18px' }}>
        Prices in {currency}. {currency === 'LKR' ? 'Paid in rupees through PayHere.' : 'Paid by international card.'}
      </p>
    </>
  );
}
