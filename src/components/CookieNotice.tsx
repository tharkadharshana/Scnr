import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';

const KEY = 'scnr_cookie_consent';

/** 'all' | 'essential' | null (not chosen yet). Gate any future analytics or ad script on `getConsent() === 'all'`. */
export const getConsent = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };

// ponytail: no optional cookies exist yet, so both buttons only store the choice. No per-category "Manage preferences" until there is more than one category.
/** Full-width consent bar at the bottom. Remembered per browser. */
export default function CookieNotice() {
  const [open, setOpen] = useState(() => getConsent() === null);
  if (!open) return null;
  const choose = (v: 'all' | 'essential') => { try { localStorage.setItem(KEY, v); } catch { /* private mode: asks again next visit */ } setOpen(false); };
  const btn: React.CSSProperties = { padding: '10px 20px', borderRadius: 999, border: 0, cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: 'inherit' };
  return (
    <div role="region" aria-label="Cookie consent" style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999, background: '#FFF6F2', color: '#1F2230',
      borderTop: '1px solid #F4DDD3', boxShadow: '0 -4px 24px rgba(0,0,0,.15)', padding: '16px 24px',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, fontFamily: 'inherit',
    }}>
      <Cookie size={34} color="#F26B3A" strokeWidth={1.5} aria-hidden="true" />
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>Your Privacy Matters</div>
        <div style={{ fontSize: 14, color: '#5B5F6E', lineHeight: 1.5 }}>
          We use cookies to keep you signed in and, with your OK, to improve the site. Learn more in our{' '}
          <Link to="/legal/privacy-policy" style={{ color: '#F26B3A', textDecoration: 'underline' }}>Privacy Policy</Link>.
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <button onClick={() => choose('essential')} style={{ ...btn, background: '#1F2230', color: '#fff' }}>Reject Non-Essential</button>
        <button onClick={() => choose('all')} style={{ ...btn, background: '#F26B3A', color: '#fff' }}>Allow All</button>
      </div>
    </div>
  );
}
