import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { useUI } from '../shared/UIContext';

// "Swap today's offer": edit a guest page's offer in place; live on the next scan, no reprint.
export default function OfferSwap({ qr, onSaved }: { qr: any; onSaved: (qr: any) => void }) {
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
