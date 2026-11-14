import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { supabase } from '../supabase';
import { useUI } from '../shared/UIContext';
import { renderGuestPage } from '../lib/guestPage';
import { normalizeMenu, MENU_LIMITS, type Menu } from '../lib/menu';
import { KIT_TEMPLATES, type KitTemplate } from '../lib/kitTemplates';
import { DESIGNS } from '../lib/kitDesigns/index';
import { ASSET } from '../lib/designs';
import DesignSlots from '../components/DesignSlots';
import { waLink } from '../lib/site';
import KitLegacy from './KitLegacy';
import QrTabs from '../components/QrTabs';
import { Link } from 'react-router-dom';

// Restaurant Kit v2: build a menu (with AI, from a file, or by hand), add the guest-page links, print one table QR.
// The result is a normal block page (qr_type 'page') whose `menu` block is editable later in the Pages editor.

const STEPS = ['Template', 'Business Details', 'Menu Preferences', 'Review & Create'];
const [S_TPL, S_BIZ, S_MENU, S_REVIEW] = [0, 1, 2, 3];
const CATEGORIES = ['Starters', 'Main Courses', 'Sides', 'Desserts', 'Beverages', 'Specials'];
const CUISINES = ['Sri Lankan', 'Indian', 'Chinese', 'Italian', 'Café & bakery', 'Seafood', 'Fast food', 'Mixed'];
const DIETARY = ['Vegetarian', 'Vegan', 'Halal', 'Gluten-free'];
// A template's sample prices carry the design's own symbol; the menu keeps only the amount and the page adds the chosen currency.
const bare = (sections: Menu['sections']) => sections.map(s => ({ ...s, items: s.items.map(it => ({ ...it, price: (it.price || '').replace(/[^\d.,]/g, '') })) }));
const bid = () => Math.random().toString(36).slice(2, 8).padEnd(6, '0');
const IMPORT_TYPES: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

const empty = {
  name: '', description: '', tagline: '', color: '#2E5D45',
  cuisine: 'Sri Lankan', categories: ['Starters', 'Main Courses', 'Beverages', 'Desserts'], currency: 'LKR', prices: true, orders: true, dietary: [] as string[], language: 'English', notes: '',
  review: '', whatsapp: '', phone: '', wifiSsid: '', wifiPassword: '', offerTitle: '', offerText: '', extraLabel: '', extraUrl: '',
};
type Form = typeof empty;
type Mode = 'ai' | 'import' | 'manual';

const Ic = {
  building: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4h4v4" /></svg>,
  doc: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l4 4v14H6z" /><path d="M9 12h7M9 16h7" /></svg>,
  tag: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12l-8 8-9-9V3h8z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>,
  arrow: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  check: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>,
};

export default function Kit() {
  const [params] = useSearchParams();
  return params.get('edit') ? <KitLegacy /> : <KitWizard key={params.get('page') || 'new'} editSlug={params.get('page') || ''} />;
}

/** A saved restaurant page back into the wizard's fields. Blocks the wizard does not know (added in the page builder) are kept as they are; ids are kept so click counts stay with their buttons. */
function parseKit(cd: any) {
  const blocks: any[] = Array.isArray(cd?.blocks) ? cd.blocks : [];
  const f: Partial<Form> = {}, ids: Record<string, string> = {}, keep: any[] = [], used = new Set<string>();
  let menu: Menu = { sections: [] };
  const once = (key: string, b: any) => { if (used.has(key)) return false; used.add(key); ids[key] = b.id; return true; };
  for (const b of blocks) {
    const u = String(b?.url || '');
    if (b?.kind === 'header' && once('header', b)) { f.name = b.name || ''; f.tagline = b.tagline || ''; }
    else if (b?.kind === 'text' && once('text', b)) f.description = b.text || '';
    else if (b?.kind === 'offer' && once('offer', b)) { f.offerTitle = b.title === "Today's offer" ? '' : b.title || ''; f.offerText = b.text || ''; }
    else if (b?.kind === 'menu' && once('menu', b)) { f.currency = /^[A-Z]{3}$/.test(String(b.currency)) ? b.currency : 'LKR'; f.prices = b.prices !== false; menu = normalizeMenu(b); }
    else if (b?.kind === 'wifi' && once('wifi', b)) { f.wifiSsid = b.ssid || ''; f.wifiPassword = b.password || ''; }
    else if (b?.kind === 'button' && b.label === 'Leave a Google review' && /^https?:\/\//i.test(u) && once('review', b)) f.review = u;
    else if (b?.kind === 'button' && b.label === 'WhatsApp us' && /wa\.me\/(\d+)/.test(u) && once('whatsapp', b)) f.whatsapp = '+' + u.match(/wa\.me\/(\d+)/)![1];
    else if (b?.kind === 'button' && b.label === 'Call us' && u.startsWith('tel:') && once('phone', b)) f.phone = u.slice(4);
    else if (b?.kind === 'button' && /^https?:\/\//i.test(u) && once('extra', b)) { f.extraLabel = b.label || ''; f.extraUrl = u; }
    else keep.push(b);
  }
  if (/^#[0-9a-f]{6}$/i.test(String(cd?.theme?.accent || ''))) f.color = cd.theme.accent;
  f.orders = !!cd?.orders?.on;
  return { f, menu, ids, keep };
}

function KitWizard({ editSlug = '' }: { editSlug?: string }) {
  const navigate = useNavigate();
  const editing = !!editSlug;
  const [loaded, setLoaded] = useState(!editSlug);
  const orig = useRef<{ cd: any; ids: Record<string, string>; keep: any[] }>({ cd: {}, ids: {}, keep: [] }); // the saved page being edited
  const { showToast } = useUI();
  const [f, setF] = useState<Form>(empty);
  const [step, setStep] = useState(S_TPL);
  const [tplId, setTplId] = useState('');
  const [slots, setSlots] = useState<Record<string, string>>({}); // the owner's slot choices; shared keys (hero, accent, headline) carry over when the template changes
  const [scr, setScr] = useState(0); // the screen of the chosen template: its design is the page's look
  const [shown, setShown] = useState<Record<string, number>>({}); // the screen each gallery card is showing
  const tpl = KIT_TEMPLATES.find(t => t.id === tplId);
  const [mode, setMode] = useState<Mode>('manual');
  const fromTpl = !!tpl && mode === 'manual'; // a template brings its own sections, so the AI-only questions are hidden
  const [menu, setMenu] = useState<Menu>({ sections: [] });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState('');
  const [saving, setSaving] = useState(false);
  const [ai, setAi] = useState<{ enabled: boolean; used_credits: number; limit_credits: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const wizardRef = useRef<HTMLDivElement>(null);
  const set = (k: keyof Form, v: any) => setF(p => ({ ...p, [k]: v }));
  const text = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value);

  useEffect(() => { // editing: load the saved page into the same fields the wizard created it from
    if (!editSlug) return;
    apiFetch(`/api/qr/${editSlug}`).then(qr => {
      const cd = qr.content_data || {};
      if (qr.qr_type !== 'page' || !Array.isArray(cd.blocks)) { navigate(`/pages/${editSlug}/edit`, { replace: true }); return; }
      const p = parseKit(cd);
      orig.current = { cd, ids: p.ids, keep: p.keep };
      setF({ ...empty, ...p.f } as Form); setMenu(p.menu); setSlots(cd.slots && typeof cd.slots === 'object' ? cd.slots : {});
      const t = KIT_TEMPLATES.find(x => x.screens.some(s => s.design === cd.design));
      if (t) { setTplId(t.id); setScr(Math.max(0, t.screens.findIndex(s => s.design === cd.design))); }
      setStep(S_BIZ); setLoaded(true);
    }).catch(() => { showToast('error', 'Could not load this restaurant'); navigate('/'); });
  }, [editSlug]);
  useEffect(() => { apiFetch('/api/ai/usage').then(setAi).catch(() => setAi({ enabled: false, used_credits: 0, limit_credits: 0 })); }, []); // AI is off unless the server says it is on (AI_ENABLED)
  const meter = (r: any) => r?.limit_credits !== undefined && setAi(a => ({ enabled: true, ...(a || {}), used_credits: r.used_credits, limit_credits: r.limit_credits }));
  const aiError = (e: any) => showToast('error', e?.status === 429 ? 'You have used all your AI credits this month. Upgrade for more.' : e?.message || 'The AI request failed. Try again.');
  const goWizard = () => wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const problems: Record<string, string> = {};
  if (step === S_BIZ && !f.name.trim()) problems.name = 'Enter your business name.';
  if (step === S_REVIEW) {
    if (!menu.sections.length && !f.review && !f.whatsapp && !f.phone && !f.wifiSsid && !f.extraUrl) problems.menu = 'Add at least one menu item or a link so guests have something to see.';
    if (f.review && !/^https?:\/\//i.test(f.review)) problems.review = 'Enter the full link, starting with https://';
    if (f.extraLabel && !/^https?:\/\//i.test(f.extraUrl)) problems.extraUrl = 'Add the full link for this button.';
    for (const k of ['whatsapp', 'phone'] as const) if (f[k] && f[k].replace(/\D/g, '').length < 7) problems[k] = 'Enter the full number with country code, e.g. +94 77 123 4567';
  }

  const generate = async () => {
    setBusy('generate');
    try {
      const r = await apiFetch('/api/ai/menu/generate', { method: 'POST', body: JSON.stringify({
        name: f.name, description: f.description, cuisine: f.cuisine, categories: f.categories, currency: f.currency, prices: f.prices, dietary: f.dietary, language: f.language, notes: f.notes }) });
      setMenu(normalizeMenu(r.menu)); meter(r);
      return true;
    } catch (e: any) { aiError(e); return false; } finally { setBusy(''); }
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const type = IMPORT_TYPES[file.type];
    if (!type) return showToast('error', 'Use a PDF, PNG, JPG or WebP file.');
    if (file.size > 10 * 1024 * 1024) return showToast('error', 'Menu files can be up to 10 MB.');
    setBusy('import'); goWizard();
    try {
      const { path, token } = await apiFetch('/api/files', { method: 'POST', body: JSON.stringify({ type, size: file.size, name: file.name }) });
      const up = await supabase.storage.from('files').uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (up.error) throw up.error;
      const r = await apiFetch('/api/ai/menu/import', { method: 'POST', body: JSON.stringify({ path, type }) });
      setMenu(normalizeMenu(r.menu)); setMode('import'); meter(r);
      showToast('success', `Found ${r.menu.sections.length} sections. Review them in the last step.`);
    } catch (e: any) { aiError(e); } finally { setBusy(''); if (fileRef.current) fileRef.current.value = ''; }
  };

  const next = async () => {
    const first = Object.keys(problems)[0];
    if (first) { setTried(true); document.getElementById(`kit-${first === 'menu' ? 'menu-box' : first}`)?.focus(); return; }
    setTried(false);
    if (step === S_MENU && mode === 'ai' && !menu.sections.length && !(await generate())) return;
    if (step === S_MENU && mode === 'manual' && !menu.sections.length) setMenu({ sections: f.categories.map(name => ({ name, items: [] })) });
    setStep(step + 1); goWizard();
  };

  const photo = async (si: number, ii: number) => {
    const it = menu.sections[si].items[ii];
    setBusy(`img-${si}-${ii}`);
    try {
      const r = await apiFetch('/api/ai/image', { method: 'POST', body: JSON.stringify({ prompt: `${it.name}${it.description ? ', ' + it.description : ''}`, purpose: 'menu_item' }) });
      updItem(si, ii, { image: r.url }); meter(r);
    } catch (e: any) { aiError(e); } finally { setBusy(''); }
  };

  const updSection = (si: number, patch: any) => setMenu(m => ({ sections: m.sections.map((s, i) => (i === si ? { ...s, ...patch } : s)) }));
  const updItem = (si: number, ii: number, patch: any) => setMenu(m => ({ sections: m.sections.map((s, i) => (i === si ? { ...s, items: s.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) } : s)) }));

  const curSample = tpl && DESIGNS[tpl.screens[scr].design].sample;
  const menuEdited = () => menu.sections.length > 0 && JSON.stringify(menu.sections) !== JSON.stringify(curSample?.sections); // true for an AI or imported menu too
  const pickTemplate = (t: KitTemplate, n: number) => {
    if (editing) { setTplId(t.id); setScr(n); setStep(S_BIZ); goWizard(); return; } // changing the look of a saved restaurant keeps its name, items and prices
    const sample = DESIGNS[t.screens[n].design].sample;
    if (t.id !== tplId || n !== scr) {
      if (menuEdited() && !window.confirm('Replace the menu you have so far with the sample items of this template?')) return;
      setF(p => ({ ...p, currency: 'USD', tagline: !p.tagline || p.tagline === curSample?.tagline ? sample.tagline || '' : p.tagline })); setMenu({ sections: bare(sample.sections) }); setMode('manual');
    }
    setTplId(t.id); setScr(n); setStep(S_BIZ); goWizard();
  };
  const startBlank = () => {
    if (tplId) { if (menuEdited() && !window.confirm('Remove the menu you have so far?')) return; setMenu({ sections: [] }); }
    setTplId(''); setStep(S_BIZ); goWizard();
  };

  const content = useMemo(() => {
    const o = orig.current, id = (k: string) => o.ids[k] || bid(); // ids of saved blocks stay, so their click counts stay
    const links = (k: string, label: string, url: string) => (url ? [{ id: id(k), kind: 'button', label, url }] : []);
    const m = normalizeMenu(menu);
    const blocks: any[] = [
      { id: id('header'), kind: 'header', name: f.name || 'Your restaurant', tagline: f.tagline },
      ...(f.description ? [{ id: id('text'), kind: 'text', text: f.description }] : []),
      ...(f.offerText ? [{ id: id('offer'), kind: 'offer', title: f.offerTitle || "Today's offer", text: f.offerText }] : []),
      ...(m.sections.length ? [{ id: id('menu'), kind: 'menu', currency: f.currency, prices: f.prices, sections: m.sections }] : []),
      ...links('review', 'Leave a Google review', f.review),
      ...links('whatsapp', 'WhatsApp us', f.whatsapp ? waLink(f.whatsapp, 'Hi! I would like to make a reservation.') : ''),
      ...links('phone', 'Call us', f.phone ? `tel:${f.phone.replace(/[^\d+]/g, '')}` : ''),
      ...links('extra', f.extraLabel, f.extraUrl),
      ...(f.wifiSsid ? [{ id: id('wifi'), kind: 'wifi', ssid: f.wifiSsid, password: f.wifiPassword }] : []),
      ...o.keep, // blocks added in the page builder stay as they were
    ];
    const { blocks: oldBlocks, theme, design: _d, slots: _s, orders: _o, i18n, ...rest } = o.cd; // everything else on the saved page is kept
    const sameShape = JSON.stringify(blocks.map(b => b.kind)) === JSON.stringify((oldBlocks || []).map((b: any) => b.kind)); // translations are per block position, so they stay only while the blocks line up
    return {
      ...rest,
      ...(sameShape && i18n ? { i18n } : {}),
      ...(f.orders ? { orders: { on: true } } : {}),
      ...(tpl ? { design: tpl.screens[scr].design, slots: Object.fromEntries(Object.entries(slots).filter(([, v]) => v)) } : {}),
      theme: { bg: '#FFF8F2', text: '#24180F', button: 'rounded', font: 'system', ...theme, accent: f.color },
      blocks,
    };
  }, [f, menu, tpl, scr, slots, loaded]);
  const previewNow = useMemo(() => { // a design with no items would render blank, so the preview shows its sample items until the menu has some
    if (!tpl || content.blocks.some((x: any) => x.kind === 'menu')) return content;
    return { ...content, blocks: [content.blocks[0], { id: 'preview', kind: 'menu', currency: f.currency, prices: f.prices, sections: bare(DESIGNS[tpl.screens[scr].design].sample.sections) }, ...content.blocks.slice(1)] };
  }, [content, tpl, scr]);
  const previewContent = useDeferredValue(previewNow); // the preview follows typing without re-rendering on every keystroke
  const previewHtml = useMemo(() => (step !== S_TPL ? (renderGuestPage({ qr_type: 'page', title: f.name, content_data: previewContent }, 'en', 'https://preview.local/p') as any)?.body?.replaceAll(ASSET, `${window.location.origin}/kit/templates/img/`) || '' : ''), [step, previewContent]); // photos from this deploy, not production; the iframe below is re-created per document because a changed srcDoc can leave a slow-loading earlier one on screen

  const save = async () => {
    const first = Object.keys(problems)[0];
    if (first) { setTried(true); return; }
    setSaving(true);
    try {
      if (JSON.stringify(content).length > 20_000) throw new Error('This menu is too long for one page. Remove a few items.');
      if (editing) {
        await apiFetch(`/api/qr/${editSlug}`, { method: 'PUT', body: JSON.stringify({ title: f.name, content_data: content }) });
        showToast('success', 'Saved. Your changes are live on the next scan, no reprint needed.');
        return;
      }
      const page = await apiFetch('/api/qr', { method: 'POST', body: JSON.stringify({
        title: f.name, qr_type: 'page', category: 'restaurant', is_dynamic: true, content_data: content,
        style: { dot_color: '#1A1916', bg_color: '#FFFFFF', dot_style: 'rounded', corner_style: 'rounded', error_correction: 'M', output_size: 1200 },
      }) });
      let wifiSlug = '';
      if (f.wifiSsid) {
        const wifi = await apiFetch('/api/qr', { method: 'POST', body: JSON.stringify({
          title: `${f.name} Wi-Fi`, qr_type: 'wifi', is_dynamic: false, content_data: { ssid: f.wifiSsid, password: f.wifiPassword, encryption: f.wifiPassword ? 'WPA' : '' },
        }) }).catch(() => null); // the plan may not allow a 2nd code; the guest page still shows the Wi-Fi details
        wifiSlug = wifi?.slug || '';
      }
      navigate(`/kit/print/${page.slug}${wifiSlug ? `?wifi=${wifiSlug}` : ''}`);
    } catch (err: any) {
      showToast('error', err?.message || (editing ? 'Could not save your changes' : 'Could not create the kit'));
      if (err?.status === 403) navigate('/billing');
    } finally { setSaving(false); }
  };

  const err = (k: string) => tried && problems[k] ? <div className="error-msg" role="alert">{problems[k]}</div> : null;
  const field = (label: string, k: keyof Form, icon: React.ReactNode, ph = '', optional = false, type = 'text') => (
    <div className="kit-field">
      <label htmlFor={`kit-${k}`}>{label}{optional ? <em> (optional)</em> : <b> *</b>}</label>
      <div className={`kit-input${tried && problems[k] ? ' bad' : ''}`}>
        <span>{icon}</span>
        <input id={`kit-${k}`} type={type} value={f[k] as string} onChange={text(k)} placeholder={ph} aria-invalid={tried && !!problems[k]} />
      </div>
      {err(k)}
    </div>
  );
  const plain = (label: string, k: keyof Form, ph = '', type = 'text') => (
    <div className="kit-field">
      <label htmlFor={`kit-${k}`}>{label}</label>
      <div className={`kit-input${tried && problems[k] ? ' bad' : ''}`}><input id={`kit-${k}`} type={type} value={f[k] as string} onChange={text(k)} placeholder={ph} /></div>
      {err(k)}
    </div>
  );
  const chips = (all: string[], on: string[], toggle: (v: string) => void) => (
    <div className="kit-chips">{all.map(c => <button type="button" key={c} className={on.includes(c) ? 'on' : ''} aria-pressed={on.includes(c)} onClick={() => toggle(c)}>{c}</button>)}</div>
  );
  const flip = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  const aiOn = ai?.enabled === true; // AI is hidden until the server reports it on

  if (!loaded) return <div className="kit"><p style={{ padding: 40, textAlign: 'center' }}>Loading your restaurant…</p></div>;

  return (
    <div className="kit">
      {editing && (
        <QrTabs slug={editSlug} active="menu" editTo={`/kit?page=${editSlug}`}>
          <Link to={`/pages/${editSlug}/edit`} className="kit-link" title="Add images, video, social links or Sinhala and Tamil text">Advanced editor (blocks and translations) →</Link>
        </QrTabs>
      )}
      <header className="kit-head">
        <button className="kit-crumb" onClick={() => navigate('/')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>Restaurant Kit</button>
        <h1>{editing ? 'Edit your restaurant menu' : 'Create your restaurant menu'}</h1>
        <p>{editing ? 'Change anything below: the look, your details, the menu and the links. The preview shows exactly what guests will see.' : aiOn ? 'Choose how you want to set up your menu. You can import your existing menu or create a new one with our easy-to-use editor.' : 'Pick a template below and make it yours: your name, colours, items and prices.'}</p>
        <div className="kit-art" aria-hidden="true">
          <i className="kit-script">Good food<br />Good mood</i>
          <img src="/kit/hero-food.webp" alt="" width="640" height="640" decoding="async" />
        </div>
      </header>

      {aiOn && !editing && <div className="kit-options">
        <section className={`kit-opt ai${mode === 'ai' ? ' sel' : ''}`}>
          <div className="kit-opt-copy">
            <div className="kit-opt-top"><span className="kit-ic peach"><svg width="26" height="26" viewBox="0 0 24 24" fill="#EE5A24"><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8zM19 14l.9 2.6L22.5 17.5l-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9zM5 15l.7 2 2 .7-2 .7L5 20.5l-.7-2.1-2-.7 2-.7z" /></svg></span><span className="kit-rec">Recommended</span></div>
            <h3>Create with AI</h3>
            <p>Let us help you build your full menu. Just tell us about your restaurant and we'll generate a complete menu with categories and items.</p>
            <button className="kit-btn" disabled={!aiOn} onClick={() => { setMode('ai'); if (tplId) setMenu({ sections: [] }); goWizard(); }}>Create with AI {Ic.arrow}</button>
            {!aiOn && <small className="kit-note">AI is not set up on this server yet.</small>}
          </div>
          <div className="kit-mock" aria-hidden="true">
            <div className="kit-mock-card"><u /><div><i className="r">🍴</i>Starters</div><div><i className="o">🥗</i>Main Courses</div><div><i className="o">🍹</i>Beverages</div><div><i className="o">🍰</i>Desserts</div></div>
            <span className="kit-wand"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EE5A24" strokeWidth="2" strokeLinecap="round"><path d="M4 20L16 8M15 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 12l.7 1.3 1.3.7-1.3.7L19 16l-.7-1.3-1.3-.7 1.3-.7z" /></svg></span>
          </div>
        </section>

        <section className={`kit-opt up${mode === 'import' ? ' sel' : ''}${drag ? ' drag' : ''}`}
          onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); if (aiOn) importFile(e.dataTransfer.files?.[0]); }}>
          <div className="kit-opt-copy">
            <div className="kit-opt-top"><span className="kit-ic blue"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M7 18a4 4 0 01-.6-7.9A6 6 0 0118 9.5 4.3 4.3 0 0117.5 18H7zM12 16v-6M9.5 12.2L12 9.7l2.5 2.5" /></svg></span></div>
            <h3>Import your menu</h3>
            <p>Upload your existing menu (PDF, image or file) and we'll extract the details for you.</p>
            <button className="kit-btn ghost" disabled={!aiOn || !!busy} onClick={() => fileRef.current?.click()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19h14" /></svg>{busy === 'import' ? 'Reading your menu…' : 'Upload Menu'}
            </button>
            <input ref={fileRef} type="file" hidden accept="application/pdf,image/png,image/jpeg,image/webp" onChange={e => importFile(e.target.files?.[0])} />
          </div>
          <div className="kit-drop" aria-hidden="true">
            <div className="kit-types"><span><i className="pdf">PDF</i>PDF</span><span><i className="jpg">JPG</i>JPG</span><span><i className="png">PNG</i>PNG</span></div>
            <div className="kit-zone"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7688" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19h14" /></svg>Drag &amp; drop or click<br />to upload</div>
          </div>
        </section>
      </div>}
      {ai?.enabled && ai.limit_credits > 0 && <p className="kit-meter">AI credits this month: <b>{ai.used_credits}</b> of {ai.limit_credits} used</p>}

      <div className="kit-body" ref={wizardRef}>
        <div className="kit-wizard">
          <ol className="kit-steps">
            {STEPS.map((s, i) => (
              <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>
                <button type="button" disabled={i > step + 1 || !!busy} aria-current={i === step ? 'step' : undefined} onClick={() => i < step ? setStep(i) : i === step + 1 && next()}>
                  <span>{i < step ? Ic.check : i + 1}</span><em>{s}</em>
                </button>{i < STEPS.length - 1 && <hr />}
              </li>
            ))}
          </ol>

          {step === S_TPL && (<>
            <h2>Start from a template</h2>
            <p className="kit-sub">Pick a look for your menu. You can change the colour, text and items afterwards, or start blank.</p>
            <div className="kit-tpls">
              {KIT_TEMPLATES.map(t => {
                const n = shown[t.id] || 0, sc = t.screens[n], go = (d: number) => setShown(p => ({ ...p, [t.id]: (n + d + t.screens.length) % t.screens.length }));
                return (
                  <div key={t.id} className={`kit-tpl${tplId === t.id ? ' on' : ''}`}>
                    <div className="kit-tpl-phone"><img src={sc.img} alt={`${t.name}: ${sc.label}`} loading="lazy" decoding="async" /></div>
                    <b>{t.name}</b>
                    {t.screens.length > 1 && <div className="kit-tpl-nav"><button type="button" aria-label="Previous screen" onClick={() => go(-1)}>‹</button><span>{sc.label} · {n + 1}/{t.screens.length}</span><button type="button" aria-label="Next screen" onClick={() => go(1)}>›</button></div>}
                    <button type="button" className="kit-btn" onClick={() => pickTemplate(t, n)}>{tplId === t.id ? 'Use this screen' : 'Use this template'}</button>
                  </div>
                );
              })}
              <div className={`kit-tpl blank${!tplId ? ' on' : ''}`}>
                <div className="kit-tpl-phone"><span>Your own design</span></div>
                <b>Start blank</b>
                <button type="button" className="kit-btn ghost" onClick={startBlank}>Start blank</button>
              </div>
            </div>
          </>)}

          {step === S_BIZ && (<>
            <h2>Tell us about your restaurant</h2>
            <p className="kit-sub">This helps us create the perfect menu for your business.</p>
            <div className="kit-grid">
              {field('Business name', 'name', Ic.building, 'Café Lagoon')}
              {field('Short description', 'description', Ic.doc, 'Cozy café with great food and coffee', true)}
              {field('Short line under the name', 'tagline', Ic.tag, 'Good Food · Great Vibes', true)}
              {!tpl && <div className="kit-field">
                <label htmlFor="kit-color">Brand colour</label>
                <div className="kit-input kit-color">
                  <i style={{ background: f.color }} />
                  <input id="kit-color" value={f.color.toUpperCase()} readOnly aria-label="Brand colour" />
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                  <input type="color" className="kit-colorpick" value={f.color} onChange={text('color')} aria-label="Pick brand colour" />
                </div>
              </div>}
            </div>
            {tpl && DESIGNS[tpl.screens[scr].design].slots?.length ? (<>
              <h3 className="kit-h3">Make the design yours</h3>
              <p className="kit-sub">These belong to the template you picked. Leave them as they are to keep the look of the picture.</p>
              <DesignSlots design={DESIGNS[tpl.screens[scr].design]} values={slots} onChange={(k, v) => setSlots(p => ({ ...p, [k]: v }))} onError={m => showToast('error', m)} />
            </>) : null}
          </>)}

          {step === S_MENU && (<>
            <h2>What does your menu look like?</h2>
            <p className="kit-sub">{fromTpl ? 'Your template menu is ready. Choose the currency and whether prices show, then edit the items in the next step.' : mode === 'ai' ? 'We use these to write your menu. You can edit everything afterwards.' : mode === 'import' ? 'Your menu was imported. These only apply if you regenerate it.' : 'We start your menu with these sections. You add the items.'}</p>
            <div className="kit-grid">
              {!fromTpl && <div className="kit-field"><label htmlFor="kit-cuisine">Cuisine</label><div className="kit-input"><select id="kit-cuisine" value={f.cuisine} onChange={text('cuisine')}>{CUISINES.map(c => <option key={c}>{c}</option>)}</select></div></div>}
              <div className="kit-field"><label htmlFor="kit-currency">Currency</label><div className="kit-input"><select id="kit-currency" value={f.currency} onChange={text('currency')}><option>LKR</option><option>USD</option></select></div></div>
            </div>
            {!fromTpl && <div className="kit-field wide"><label>Menu sections</label>{chips(CATEGORIES, f.categories, c => set('categories', flip(f.categories, c)))}</div>}
            {!fromTpl && <div className="kit-field wide"><label>Dietary labels (optional)</label>{chips(DIETARY, f.dietary, c => set('dietary', flip(f.dietary, c)))}</div>}
            <div className="kit-grid">
              {!fromTpl && <div className="kit-field"><label htmlFor="kit-language">Menu language</label><div className="kit-input"><select id="kit-language" value={f.language} onChange={text('language')}><option>English</option><option>Sinhala</option><option>Tamil</option></select></div></div>}
              <label className="kit-switch"><input type="checkbox" checked={f.prices} onChange={e => set('prices', e.target.checked)} /><span />Show prices</label>
              <label className="kit-switch"><input type="checkbox" checked={f.orders} onChange={e => set('orders', e.target.checked)} /><span />Let guests order from their phone</label>
            </div>
            {mode === 'ai' && <div className="kit-field wide"><label htmlFor="kit-notes">Anything else we should know <em>(optional)</em></label><div className="kit-input"><input id="kit-notes" value={f.notes} onChange={text('notes')} placeholder="Famous for crab curry, all dishes can be made mild" /></div></div>}
          </>)}

          {step === S_REVIEW && (
            <div className="kit-review">
              <div>
                <h2>Review your menu</h2>
                <p className="kit-sub">Edit anything, then create your kit. You can change it later without reprinting.</p>
                <div id="kit-menu-box" tabIndex={-1}>{err('menu')}</div>
                {aiOn && f.name && <button className="kit-link" disabled={!!busy} onClick={() => generate()}>{busy === 'generate' ? 'Writing…' : menu.sections.length ? '✨ Regenerate with AI' : '✨ Write my menu with AI'}</button>}
                {menu.sections.map((s, si) => (
                  <div className="kit-sec" key={si}>
                    <div className="kit-sec-head">
                      <input value={s.name} onChange={e => updSection(si, { name: e.target.value })} aria-label="Section name" />
                      <button className="kit-x" aria-label="Remove section" onClick={() => setMenu(m => ({ sections: m.sections.filter((_, i) => i !== si) }))}>×</button>
                    </div>
                    {s.items.map((it, ii) => (
                      <div className="kit-item" key={ii}>
                        {it.image ? <img src={it.image} alt="" /> : aiOn ? <button className="kit-photo" disabled={!!busy || !it.name} title="Generate a photo with AI" onClick={() => photo(si, ii)}>{busy === `img-${si}-${ii}` ? '…' : '📷'}</button> : null}
                        <div>
                          <input value={it.name} onChange={e => updItem(si, ii, { name: e.target.value })} placeholder="Item name" aria-label="Item name" />
                          <input value={it.description || ''} onChange={e => updItem(si, ii, { description: e.target.value })} placeholder="Short description" aria-label="Description" />
                        </div>
                        {f.prices && <input className="kit-price" inputMode="decimal" value={it.price || ''} onChange={e => updItem(si, ii, { price: e.target.value })} placeholder={f.currency} aria-label="Price" />}
                        <button className="kit-x" aria-label="Remove item" onClick={() => setMenu(m => ({ sections: m.sections.map((x, i) => (i === si ? { ...x, items: x.items.filter((_, j) => j !== ii) } : x)) }))}>×</button>
                      </div>
                    ))}
                    {s.items.length < MENU_LIMITS.items && <button className="kit-link" onClick={() => updSection(si, { items: [...s.items, { name: '' }] })}>+ Add item</button>}
                  </div>
                ))}
                {menu.sections.length < MENU_LIMITS.sections && <button className="kit-link" onClick={() => setMenu(m => ({ sections: [...m.sections, { name: 'New section', items: [{ name: '' }] }] }))}>+ Add section</button>}

                <h3 className="kit-h3">Guest page extras</h3>
                <div className="kit-grid">
                  {plain('Google review link', 'review', 'https://g.page/r/…/review', 'url')}
                  {plain("Today's offer", 'offerText', 'Kottu night: 20% off after 7pm')}
                  {plain('WhatsApp number', 'whatsapp', '+94 77 123 4567', 'tel')}
                  {plain('Phone number', 'phone', '+94 11 234 5678', 'tel')}
                  {plain('Wi-Fi name', 'wifiSsid', 'Lagoon-Guest')}
                  {plain('Wi-Fi password', 'wifiPassword', 'kottu2026')}
                  {plain('Extra button label', 'extraLabel', 'Order online')}
                  {plain('Extra button link', 'extraUrl', 'https://…', 'url')}
                </div>
              </div>
            </div>
          )}

          <div className="kit-foot">
            <button className="kit-back" disabled={step === S_TPL || !!busy} onClick={() => setStep(step - 1)}>Back</button>
            {step < S_REVIEW
              ? <button className="kit-btn" disabled={!!busy} onClick={next}>{busy === 'generate' ? 'Writing your menu…' : <>Continue {Ic.arrow}</>}</button>
              : <button className="kit-btn" disabled={saving || !!busy} onClick={save}>{saving ? 'Saving…' : <>{editing ? 'Save changes' : 'Create kit and print'} {Ic.arrow}</>}</button>}
          </div>
        </div>

        {step !== S_TPL ? (
          <aside className="kit-live">
            <h4>Live preview</h4>
            <div className="kit-preview"><div><iframe key={previewHtml} title="Guest page preview" srcDoc={previewHtml} sandbox="" /></div></div>
            <p>Updates as you type. Scroll inside the phone to see offers, buttons and Wi-Fi under the menu.</p>
          </aside>
        ) : (
        <aside className="kit-why">
          <h4>Why create with AI?</h4>
          <ul>{['Saves time', 'Creates a professional menu', 'Smart category suggestions', 'Fully editable afterwards'].map(t => <li key={t}><span>{Ic.check}</span>{t}</li>)}</ul>
          <i className="kit-script small">From your idea<br />to a beautiful menu<br />in minutes.</i>
          <svg className="kit-leaf" style={{ left: 18, top: 318 }} viewBox="0 0 40 40" aria-hidden="true"><path d="M4 36C4 16 16 4 36 4c0 20-12 32-32 32z" fill="#3E7B4F" /><path d="M6 34L30 10" stroke="#7FB88F" strokeWidth="1.6" /></svg>
          <svg className="kit-leaf" style={{ right: 6, bottom: 22, transform: 'rotate(20deg)' }} viewBox="0 0 40 40" aria-hidden="true"><path d="M4 36C4 16 16 4 36 4c0 20-12 32-32 32z" fill="#55906A" /></svg>
          <div className="kit-phone" aria-hidden="true">
            <b><i>🍃</i>Café Lagoon</b>
            <small>Starters</small><p><span><u>🥖</u>Bruschetta</span><em>$6.50</em></p><p><span><u>🍞</u>Garlic Bread</span><em>$4.50</em></p><p><span><u>🍄</u>Stuffed Mushrooms</span><em>$7.00</em></p>
            <small>Main Courses</small><p><span><u>🍗</u>Grilled Chicken</span><em>$14.50</em></p><p><span><u>🍔</u>Beef Burger</span><em>$12.00</em></p><p><span><u>🍝</u>Pasta Alfredo</span><em>$11.50</em></p>
            <small>Desserts</small><p><span><u>🍫</u>Chocolate Lava Cake</span><em>$6.50</em></p><p><span><u>🍰</u>Cheesecake</span><em>$5.50</em></p>
          </div>
        </aside>
        )}
      </div>
    </div>
  );
}
