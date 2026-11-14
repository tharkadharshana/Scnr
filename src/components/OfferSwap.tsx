import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { useUI } from '../shared/UIContext';

// "Swap today's offer": edit a guest page's offer in place; live on the next scan, no reprint.
export default function OfferSwap({ qr, onSaved }: { qr: any; onSaved: (qr: any) => void }) {
  const { showToast } = useUI();
  const cd = qr.content_data || {};
  const [text, setText] = useState((Array.isArray(cd.blocks) && cd.blocks.find((b: any) => b.kind === 'offer')?.text) || cd.offer?.text || '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      let content_data: any;
      if (Array.isArray(cd.blocks)) { // block pages and restaurants keep the offer as one `offer` block; the server drops a flat `offer` key
        const rest = cd.blocks.filter((b: any) => b.kind !== 'offer'), old = cd.blocks.find((b: any) => b.kind === 'offer');
        const at = old ? cd.blocks.indexOf(old) : Math.min(1, rest.length); // keep its place; a new one goes right after the header
        const blocks = text ? [...rest.slice(0, at), { ...(old || { id: Math.random().toString(36).slice(2, 8), kind: 'offer' }), text }, ...rest.slice(at)] : rest;
        content_data = { ...cd, blocks };
      } else content_data = { ...cd, offer: text ? { ...(cd.offer || {}), text } : undefined };
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
