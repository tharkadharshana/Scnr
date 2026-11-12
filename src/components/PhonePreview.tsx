import { useState } from 'react';
import { getQRContent } from '../lib/qrContent';

const hex = (v: unknown) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v) : '');

/** What a code shows when scanned, as a small phone: the template's own picture for Kit pages, a drawn mock for everything else. */
function mock(q: any): { icon: string; title: string; lines: string[]; cta: string } {
  const d = q.content_data || {};
  const blocks: any[] = Array.isArray(d.blocks) ? d.blocks : [];
  switch (q.qr_type) {
    case 'vcard': return { icon: '👤', title: [d.first_name, d.last_name].filter(Boolean).join(' ') || q.title || 'Contact', lines: [d.phone, d.email, d.company].filter(Boolean), cta: 'Save contact' };
    case 'wifi': return { icon: '📶', title: d.ssid || q.title || 'Wi-Fi', lines: ['Password ••••••'], cta: 'Copy password' };
    case 'form': return { icon: '📝', title: d.title || q.title || 'Form', lines: (d.fields || []).slice(0, 3).map((f: any) => f.label).filter(Boolean), cta: d.submit_label || 'Send' };
    case 'event': return { icon: '📅', title: d.title || q.title || 'Event', lines: [d.location, String(d.start || '').slice(0, 10)].filter(Boolean), cta: 'Add to calendar' };
    case 'email': return { icon: '✉️', title: q.title || 'Email', lines: [d.email].filter(Boolean), cta: '' };
    case 'text': return { icon: '💬', title: q.title || 'Message', lines: [String(d.text || '').slice(0, 40)].filter(Boolean), cta: '' };
    case 'page': {
      const head = blocks.find(b => b?.kind === 'header');
      const menu = blocks.find(b => b?.kind === 'menu');
      const rows = menu ? (menu.sections || []).flatMap((s: any) => (s.items || []).map((i: any) => i.name)) : blocks.filter(b => b?.kind === 'button').map(b => b.label);
      return { icon: menu ? '🍽️' : '📄', title: head?.name || q.title || 'Page', lines: rows.filter(Boolean).slice(0, 4), cta: '' };
    }
    default: { let host = ''; try { host = new URL(q.destination_url).hostname; } catch { /* no address yet */ } return { icon: '🔗', title: host || q.title || 'Link', lines: [], cta: '' }; }
  }
}

/** Only pages, forms and business cards show a phone: for the rest there is nothing to preview. */
export default function PhonePreview({ qr }: { qr: any }) {
  if (!['page', 'form', 'vcard'].includes(qr.qr_type)) return null; // Wi-Fi, text, email, event and plain links have nothing worth previewing: the QR alone is the card
  const d = qr.content_data || {};
  const design = typeof d.design === 'string' && /^[a-z0-9-]+$/.test(d.design) ? d.design : '';
  const [bad, setBad] = useState(false);
  if (design && !bad) {
    return (
      <a className="rc-prev" href={getQRContent(qr)} target="_blank" rel="noopener" title="Open the live page">
        <img src={`/kit/templates/${design}.jpg`} alt="How your page looks" loading="lazy" onError={() => setBad(true)} />
      </a>
    );
  }
  const m = mock(qr);
  const accent = hex(d.theme?.accent) || hex(qr.style?.dot_color) || '#E85D3A';
  return (
    <div className="rc-prev" title="Preview" aria-hidden="true">
      <div className="rc-mock">
        <div className="rc-mock-top" style={{ background: accent }}><i>{m.icon}</i><b>{m.title}</b></div>
        <div className="rc-mock-body">
          {m.lines.map((l, i) => <span key={i}>{l}</span>)}
          {m.cta && <em style={{ background: accent }}>{m.cta}</em>}
        </div>
      </div>
    </div>
  );
}
