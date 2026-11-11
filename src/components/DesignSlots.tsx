import React, { useState } from 'react';
import { apiFetch } from '../lib/api';
import { supabase } from '../supabase';
import { ASSET, type Design } from '../lib/designs';

// The owner's image, colour and text choices for a design (content_data.slots). Empty means "the design's own".
const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const local = (u: string) => u.replace(ASSET, `${window.location.origin}/kit/templates/img/`);

export default function DesignSlots({ design, values, onChange, onError }: { design: Design; values: Record<string, string>; onChange: (key: string, value: string) => void; onError: (msg: string) => void }) {
  const [busy, setBusy] = useState('');
  if (!design.slots?.length) return <p style={{ fontSize: 13, opacity: .7 }}>This design has no extra options. Change the name, items and prices.</p>;

  const upload = async (key: string, file?: File) => {
    if (!file) return;
    const type = TYPES[file.type];
    if (!type) return onError('Use a PNG, JPG or WebP image.');
    if (file.size > 10 * 1024 * 1024) return onError('Images can be up to 10 MB.');
    setBusy(key);
    try {
      const r = await apiFetch('/api/files', { method: 'POST', body: JSON.stringify({ type, size: file.size, name: file.name }) });
      const up = await supabase.storage.from('files').uploadToSignedUrl(r.path, r.token, file, { contentType: file.type });
      if (up.error) throw up.error;
      onChange(key, r.publicUrl);
    } catch (e: any) { onError(e?.message || 'Could not upload the image'); } finally { setBusy(''); }
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {design.slots.map(s => {
        const v = values[s.key] || '', shown = v || s.default;
        const reset = v ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(s.key, '')}>Use the design's own</button> : null;
        return (
          <div key={s.key} className="form-section" style={{ margin: 0 }}>
            <label className="form-label" htmlFor={`slot-${s.key}`}>{s.label}</label>
            {s.type === 'text' && <input id={`slot-${s.key}`} className="form-input" maxLength={s.max || 80} value={v} placeholder={s.default} onChange={e => onChange(s.key, e.target.value)} />}
            {s.type === 'color' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input id={`slot-${s.key}`} type="color" className="form-input" style={{ width: 64, height: 40, padding: 4 }} value={/^#[0-9a-f]{6}$/i.test(shown) ? shown : '#000000'} onChange={e => onChange(s.key, e.target.value)} />
                <code style={{ fontSize: 12 }}>{shown.toUpperCase()}</code>{reset}
              </div>
            )}
            {s.type === 'image' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <img src={local(shown)} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                <div style={{ display: 'grid', gap: 6, flex: 1, minWidth: 200 }}>
                  <input id={`slot-${s.key}`} className="form-input" type="url" placeholder="https://… (paste a link)" value={v} onChange={e => onChange(s.key, e.target.value.trim())} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>{busy === s.key ? 'Uploading…' : 'Upload image'}<input type="file" hidden accept="image/png,image/jpeg,image/webp" disabled={!!busy} onChange={e => { upload(s.key, e.target.files?.[0]); e.target.value = ''; }} /></label>
                    {reset}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
