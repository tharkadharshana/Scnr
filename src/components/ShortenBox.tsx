import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useUI } from '../shared/UIContext';
import { normalizeUrl } from '../lib/url';
import { useLinkCheck } from '../hooks/useLinkCheck';
import LinkCheck from './LinkCheck';
import { getQRContent, shortHost, slugProblem } from '../lib/qrContent';

/** "Paste a link": a short link in one step (kind 'link', no QR image). Lives on the Create QR page; the new link then shows on the Dashboard's Short links tab. */
export default function ShortenBox({ noCustomSlug }: { noCustomSlug: boolean }) {
  const { showToast } = useUI();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [backHalf, setBackHalf] = useState('');
  const [busy, setBusy] = useState(false);
  const check = useLinkCheck(url);

  const shorten = async () => {
    const fixed = normalizeUrl(url);
    if (!fixed.ok) return showToast('error', fixed.error!);
    if (slugProblem(backHalf)) return showToast('error', slugProblem(backHalf));
    setBusy(true);
    try {
      const qr = await apiFetch('/api/qr', { method: 'POST', body: JSON.stringify({ kind: 'link', qr_type: 'url', destination_url: fixed.url, title: new URL(fixed.url).hostname.slice(0, 120), ...(backHalf ? { slug: backHalf } : {}) }) });
      const short = getQRContent(qr);
      navigator.clipboard?.writeText(short).catch(() => {});
      showToast('success', `${short} is ready and copied.`);
      navigate('/?tab=link');
    } catch (err: any) {
      showToast('error', err?.message || 'Could not shorten that link');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card mb16">
      <div className="card-title">Just need a short link?</div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Link to shorten" className="form-input" style={{ flex: '3 1 260px' }} placeholder="Paste a link, e.g. example.com/a-long-link"
          value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') shorten(); }} />
        <input aria-label="Custom back-half" className={`form-input ${slugProblem(backHalf) ? 'error' : ''}`} style={{ flex: '1 1 150px' }} maxLength={40}
          placeholder={noCustomSlug ? 'Back-half (Pro)' : 'Back-half (optional)'} disabled={noCustomSlug}
          value={backHalf} onChange={e => setBackHalf(e.target.value.trim())} />
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={shorten}>Shorten</button>
      </div>
      <LinkCheck check={check} onUse={setUrl} />
      {slugProblem(backHalf) ? <div className="error-msg">{slugProblem(backHalf)}</div>
        : noCustomSlug && <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '6px' }}>Pick your own back-half ({shortHost()}/your-name) on <Link to="/billing" style={{ color: 'var(--coral)' }}>Pro</Link>.</div>}
    </div>
  );
}
