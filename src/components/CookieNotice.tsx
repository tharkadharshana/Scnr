import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X } from 'lucide-react';

const KEY = 'scnr_cookie_consent';

/** 'all' | 'essential' | null (not chosen yet). Gate any future analytics or ad script on `getConsent() === 'all'`. */
export const getConsent = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };

// ponytail: no optional cookies exist yet, so "Learn more and customize" links to the policy. Build a per-category modal when a second category exists.
/** Floating consent card at the bottom. Remembered per browser. */
export default function CookieNotice() {
  const [open, setOpen] = useState(() => getConsent() === null);
  if (!open) return null;
  const choose = (v: 'all' | 'essential') => { try { localStorage.setItem(KEY, v); } catch { /* private mode: asks again next visit */ } setOpen(false); };
  const btn: React.CSSProperties = { padding: '10px 22px', borderRadius: 999, border: '1px solid #F26B3A', cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: 'inherit', background: '#fff', color: '#F26B3A', textDecoration: 'none', display: 'inline-block' };
  const link: React.CSSProperties = { color: '#F26B3A', fontWeight: 600 };
  return (
    <div role="region" aria-label="Cookie consent" style={{
      position: 'fixed', left: 16, right: 16, bottom: 16, margin: '0 auto', maxWidth: 1100, zIndex: 9999, background: '#fff', color: '#1F2230',
      border: '1px solid #E6E8EE', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,.2)', padding: '20px 24px', fontFamily: 'inherit',
    }}>
      <button onClick={() => choose('essential')} aria-label="Close" style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 0, cursor: 'pointer', color: '#5B5F6E', padding: 4, display: 'flex' }}><X size={18} /></button>
      <div style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, paddingRight: 28 }}>
        Cookies for starters <Cookie size={20} color="#F26B3A" aria-hidden="true" />
      </div>
      <div style={{ fontSize: 14, color: '#5B5F6E', lineHeight: 1.6, margin: '10px 0 16px', display: 'grid', gap: 8, maxWidth: 820 }}>
        <p style={{ margin: 0 }}>We use only the cookies needed to keep you signed in and to remember this choice. We do not use advertising or tracking cookies. By default, only necessary cookies are enabled.</p>
        <p style={{ margin: 0 }}>You can accept them all or reject the optional ones. Check out our <Link to="/legal/privacy-policy" style={link}>privacy policy</Link>.</p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
        <Link to="/legal/privacy-policy#cookies" style={btn}>Learn more and customize</Link>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => choose('essential')} style={btn}>Reject</button>
          <button onClick={() => choose('all')} style={{ ...btn, background: '#1F2230', borderColor: '#1F2230', color: '#fff' }}>Accept</button>
        </div>
      </div>
    </div>
  );
}
