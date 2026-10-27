import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const KEY = 'scnr_cookie_notice';

// ponytail: notice only, no accept/reject toggles. We set no tracking or ad cookies; if analytics or ads are added, replace with a real consent choice.
const seen = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

/** Bottom bar telling visitors we only use essential storage (sign-in). Dismissed once, remembered per browser. */
export default function CookieNotice() {
  const [open, setOpen] = useState(() => !seen());
  if (!open) return null;
  const close = () => { try { localStorage.setItem(KEY, '1'); } catch { /* private mode: shows again next visit */ } setOpen(false); };
  return (
    <div role="region" aria-label="Cookie notice" style={{
      position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 9999, maxWidth: 560, margin: '0 auto',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '12px 16px',
      background: '#17181D', color: '#E8E7E1', border: '1px solid #2A2B31', borderRadius: 12,
      boxShadow: '0 8px 30px rgba(0,0,0,.4)', fontSize: 13, lineHeight: 1.45, fontFamily: 'inherit',
    }}>
      <span style={{ flex: '1 1 240px' }}>
        We only use essential cookies and browser storage to keep you signed in. No ads, no tracking.{' '}
        <Link to="/legal/privacy-policy" style={{ color: 'inherit', textDecoration: 'underline' }}>Privacy policy</Link>
      </span>
      <button onClick={close} style={{
        padding: '8px 18px', borderRadius: 8, border: 0, cursor: 'pointer', fontWeight: 600, fontSize: 13,
        background: '#E8E7E1', color: '#0C0D10',
      }}>Got it</button>
    </div>
  );
}
