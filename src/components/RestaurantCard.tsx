import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { BarChart3, Copy, ExternalLink, Pencil, ReceiptText, QrCode } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useUI } from '../shared/UIContext';
import { getQRContent, SHORT_DOMAIN } from '../lib/qrContent';
import { pageEditPath } from '../pages/Pages';

// "Swap today's offer": edit a guest page's offer in place; live on the next scan, no reprint.
function OfferSwap({ qr, onSaved }: { qr: any; onSaved: (qr: any) => void }) {
  const { showToast } = useUI();
  const [text, setText] = useState(qr.content_data?.offer?.text || '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const content_data = { ...qr.content_data, offer: text ? { ...(qr.content_data?.offer || {}), text } : undefined };
      if (content_data.kit) content_data.kit = { ...content_data.kit, offerText: text };
      await apiFetch(`/api/qr/${qr.slug}`, { method: 'PUT', body: JSON.stringify({ content_data }) });
      onSaved({ ...qr, content_data });
      showToast('success', 'Offer is live on the next scan. No reprint needed.');
    } catch (err: any) {
      showToast('error', err?.message || 'Could not save the offer');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="rc-offer">
      <span>Today's offer</span>
      <input aria-label={`Today's offer for ${qr.title}`} className="form-input" value={text}
        placeholder="e.g. Kottu night: 20% off after 7pm" onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); }} />
      <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Make live'}</button>
    </div>
  );
}

/** One restaurant on the Dashboard: the look of its page, the QR a guest scans, the ways to manage it, and today's offer. */
export default function RestaurantCard({ qr, summary, onViewQR, onSaved }: { qr: any; summary?: { open: number; today: number }; onViewQR: (qr: any) => void; onSaved: (qr: any) => void }) {
  const { showToast } = useUI();
  const canvas = useRef<HTMLCanvasElement>(null);
  const scanUrl = getQRContent(qr) || SHORT_DOMAIN;
  const design = typeof qr.content_data?.design === 'string' && /^[a-z0-9-]+$/.test(qr.content_data.design) ? qr.content_data.design : '';
  const [noPreview, setNoPreview] = useState(false);
  const ordersOn = !!qr.content_data?.orders?.on;

  useEffect(() => { // the same QR a guest scans (this exact link), in the colours chosen for it
    if (canvas.current) QRCode.toCanvas(canvas.current, scanUrl, { width: 132, margin: 1, color: { dark: qr.style?.dot_color || '#000000', light: qr.style?.bg_color || '#FFFFFF' } }).catch(() => {});
  }, [scanUrl, qr.style?.dot_color, qr.style?.bg_color]);

  return (
    <div className="rc">
      <div className="rc-main">
        {design && !noPreview && (
          <a className="rc-prev" href={scanUrl} target="_blank" rel="noopener" title="Open the live page">
            <img src={`/kit/templates/${design}.jpg`} alt="How your page looks" loading="lazy" onError={() => setNoPreview(true)} />
          </a>
        )}
        <button type="button" className="rc-qr" title="View and download the QR code" onClick={() => onViewQR(qr)}>
          <canvas ref={canvas} width={132} height={132} aria-label="QR code of this page" />
          <span><QrCode size={12} /> Scan or download</span>
        </button>
        <div className="rc-info">
          <Link to={`/analytics/${qr.slug}`} className="rc-name">{qr.title || 'Restaurant'}</Link>
          <div className="rc-url">
            <span>{scanUrl.replace(/^https?:\/\//, '')}</span>
            <button type="button" aria-label="Copy link" onClick={() => { navigator.clipboard?.writeText(scanUrl).then(() => showToast('success', 'Link copied')).catch(() => {}); }}><Copy size={14} /></button>
            <a href={scanUrl} target="_blank" rel="noopener" aria-label="Open the page"><ExternalLink size={14} /></a>
          </div>
          {ordersOn && <Link to={`/analytics/${qr.slug}/orders`} className={`rc-chip${summary?.open ? ' hot' : ''}`}>{!summary ? 'Orders' : summary.open ? `${summary.open} open order${summary.open === 1 ? '' : 's'}` : 'No open orders'}{summary?.today ? ` · ${summary.today} today` : ''}</Link>}
          <div className="rc-links">
            <Link to={`/analytics/${qr.slug}`}><BarChart3 size={15} />Analytics</Link>
            <Link to={pageEditPath(qr)}><Pencil size={15} />Menu &amp; kit</Link>
            <Link to={`/analytics/${qr.slug}/orders`}><ReceiptText size={15} />Orders</Link>
          </div>
        </div>
      </div>
      <OfferSwap qr={qr} onSaved={onSaved} />
    </div>
  );
}
