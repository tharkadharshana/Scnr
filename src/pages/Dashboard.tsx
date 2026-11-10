import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import QRCode from 'qrcode';
import QRCodeStyling from 'qr-code-styling';
import { zipSync } from 'fflate';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { apiFetch } from '../lib/api';
import { useUI } from '../shared/UIContext';
import QRViewerModal from '../components/QRViewerModal';
import IconButton from '../components/IconButton';
import CountryDonut from '../components/CountryDonut';
import { normalizeUrl } from '../lib/url';
import { useLinkCheck } from '../hooks/useLinkCheck';
import LinkCheck from '../components/LinkCheck';
import { BarChart3, Pencil, Inbox, Trash2, QrCode, Activity, Copy } from 'lucide-react';
import { pageEditPath } from './Pages';
import { getQRContent, SHORT_DOMAIN, shortHost, stylingOptions, framedSvg, slugProblem } from '../lib/qrContent';

// Dashboard tabs over the one loaded list.
const TABS: [string, string][] = [['qr', 'QR codes'], ['page', 'Pages'], ['link', 'Short links'], ['form', 'Forms']];
const tabOf = (q: any) => (q.kind === 'link' ? 'link' : q.qr_type === 'page' ? 'page' : q.qr_type === 'form' ? 'form' : 'qr');
const SORTS: Record<string, [string, (a: any, b: any) => number]> = {
  newest: ['Newest', (a, b) => String(b.created_at).localeCompare(String(a.created_at))],
  oldest: ['Oldest', (a, b) => String(a.created_at).localeCompare(String(b.created_at))],
  scans: ['Most scans', (a, b) => (b.stats?.total_scans || 0) - (a.stats?.total_scans || 0)],
  name: ['Name', (a, b) => String(a.title || a.slug).localeCompare(String(b.title || b.slug))],
};

function saveBlob(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

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
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 600, minWidth: '140px' }}>{qr.title}</span>
      <input aria-label={`Today's offer for ${qr.title}`} className="form-input" style={{ flex: 1, minWidth: '200px' }} value={text}
        placeholder="e.g. Kottu night: 20% off after 7pm" onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); }} />
      <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Make live'}</button>
    </div>
  );
}

export default function Dashboard() {
  const [qrCodes, setQrCodes] = useState<any[]>([]);
  const [tab, setTab] = useState('qr');
  const [folder, setFolder] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState('newest');
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  useEffect(() => { setSearch(searchParams.get('q') || ''); }, [searchParams]); // the top bar search sets ?q=
  const [selected, setSelected] = useState<Set<string> | null>(null); // null = not in select mode
  const [pasteUrl, setPasteUrl] = useState('');
  const pasteCheck = useLinkCheck(pasteUrl);
  const [backHalf, setBackHalf] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewQR, setViewQR] = useState<any | null>(null);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [timeseries, setTimeseries] = useState<any[] | null>(null); // null = still loading; each block shows its own skeleton until its data arrives
  const [rangeMode, setRangeMode] = useState<'days' | 'range'>('days');
  const [days, setDays] = useState(30);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [devices, setDevices] = useState<any[] | null>(null);
  const [countries, setCountries] = useState<any[] | null>(null);
  const [recentScans, setRecentScans] = useState<any[] | null>(null);
  const [scansShown, setScansShown] = useState(5);
  const [codesReady, setCodesReady] = useState(false);
  const [planData, setPlanData] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { showModal, showToast } = useUI();
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  const fetchTimeseries = async () => {
    if (!userId) return;
    try {
      let url = `/api/analytics/account/${userId}/timeseries`;
      if (rangeMode === 'days') {
        url += `?days=${days}`;
      } else if (startDate && endDate) {
        url += `?start=${startDate}&end=${endDate}`;
      } else {
        return;
      }
      const data = await apiFetch(url);
      setTimeseries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch timeseries', err);
      setTimeseries([]);
    }
  };

  useEffect(() => {
    fetchTimeseries();
  }, [userId, days, rangeMode, startDate, endDate]);

  useEffect(() => {
    if (!userId) return;

    // Every block paints the moment its own request returns; nothing waits for the slowest one.
    const rows = (set: (v: any[]) => void) => (d: any) => set(Array.isArray(d) ? d : []);
    loadCodes().catch(() => {}).finally(() => setCodesReady(true));
    apiFetch(`/api/analytics/account/${userId}/devices`).catch(() => []).then(rows(setDevices));
    apiFetch(`/api/analytics/account/${userId}/countries`).catch(() => []).then(rows(setCountries));
    apiFetch(`/api/analytics/account/${userId}/recent`).catch(() => []).then(rows(setRecentScans));
    apiFetch('/api/user/plan').catch(() => null).then(setPlanData);
  }, [userId]);

  // QR codes, pages and short links in one list, each with its stats from the server-side join.
  const loadCodes = async () => {
    const codes = await apiFetch('/api/qr');
    const codesArray = Array.isArray(codes) ? codes : [];
    setQrCodes(codesArray);
    const newStats: Record<string, any> = {};
    codesArray.forEach((qr: any) => {
      if (qr.stats) newStats[qr.id] = qr.stats;
    });
    setStats(newStats);
  };

  // "Paste a link": a short link straight from the Dashboard (kind 'link'; no QR image).
  const shorten = async () => {
    const fixed = normalizeUrl(pasteUrl);
    if (!fixed.ok) return showToast('error', fixed.error!);
    const url = fixed.url;
    if (slugProblem(backHalf)) return showToast('error', slugProblem(backHalf));
    setBusy(true);
    try {
      const qr = await apiFetch('/api/qr', { method: 'POST', body: JSON.stringify({ kind: 'link', qr_type: 'url', destination_url: url, title: new URL(url).hostname.slice(0, 120), ...(backHalf ? { slug: backHalf } : {}) }) });
      const short = getQRContent(qr);
      navigator.clipboard?.writeText(short).catch(() => {});
      showToast('success', `${short} is ready and copied.`);
      setPasteUrl('');
      setBackHalf('');
      setTab('link');
      await loadCodes();
    } catch (err: any) {
      showToast('error', err?.message || 'Could not shorten that link');
    } finally {
      setBusy(false);
    }
  };

  // Select mode: one server call for many codes, then reload and report what happened.
  const bulk = async (action: string, value?: string) => {
    if (!selected?.size) return;
    try {
      const r = await apiFetch('/api/qr/bulk', { method: 'POST', body: JSON.stringify({ slugs: [...selected], action, value }) });
      const why = [...new Set((r.failed || []).map((f: any) => f.error))].join(', ');
      showToast(r.failed?.length ? 'warning' : 'success', `${r.done.length} done${r.failed?.length ? `, ${r.failed.length} failed (${why})` : ''}.`);
      setSelected(new Set());
      await loadCodes();
    } catch (err: any) {
      showToast('error', err?.message || 'That did not work. Try again.');
    }
  };
  const askBulk = (action: string, title: string, message: string, confirmText: string) =>
    showModal({ type: 'prompt', title, message, confirmText, onConfirm: v => bulk(action, (v || '').trim()) });

  // Download ZIP: one 1000 px SVG per selected QR code (short links have no image), named after the title.
  const downloadZip = async () => {
    const codes = qrCodes.filter(q => selected?.has(q.slug) && q.kind !== 'link');
    if (!codes.length) return showToast('info', 'Select at least one QR code. Short links have no image.');
    setBusy(true);
    try {
      const files: Record<string, Uint8Array> = {}, used = new Set<string>();
      for (const qr of codes) {
        const raw = await new QRCodeStyling({ ...stylingOptions(qr.style, getQRContent(qr), 1000), type: 'svg' }).getRawData('svg');
        let svg = await (raw as Blob).text();
        if (qr.style?.frame) svg = framedSvg(svg, 1000, qr.style.frame);
        const base = String(qr.title || qr.slug).replace(/[^a-z0-9-]+/gi, '_').slice(0, 60) || qr.slug;
        let name = base, i = 2;
        while (used.has(name.toLowerCase())) name = `${base}-${i++}`;
        used.add(name.toLowerCase());
        files[`${name}.svg`] = new TextEncoder().encode(svg);
      }
      saveBlob(new Blob([zipSync(files) as BlobPart], { type: 'application/zip' }), 'scnr-codes.zip');
    } catch {
      showToast('error', 'Could not build the ZIP. Try fewer codes.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (qrId: string, slug: string) => {
    showModal({
      type: 'confirm',
      title: 'Delete QR Code',
      message: 'Are you sure you want to delete this QR code? This action cannot be undone and all historical scan data, analytics, and stats related to this QR code will be permanently deleted.',
      confirmText: 'Delete Permanently',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await apiFetch(`/api/qr/${slug}`, {
            method: 'DELETE'
          });
          
          setQrCodes(prev => prev.filter(qr => qr.id !== qrId));
          setStats(prev => {
            const next = { ...prev };
            delete next[qrId];
            return next;
          });
          showToast('success', 'QR code deleted successfully');
        } catch (err) {
          console.error(err);
          showToast('error', 'Error deleting QR code.');
        }
      }
    });
  };

  // ponytail: tabs, filters, sort and search run client-side over the loaded list; move them server-side
  // (GET /api/qr already takes ?kind, ?tag, ?folder) if a list exceeds 2,000 rows.
  const needle = search.trim().toLowerCase();
  const shown = qrCodes
    .filter(q => tabOf(q) === tab && (!folder || q.client === folder) && (!tag || (q.tags || []).includes(tag))
      && (!needle || [q.title, q.slug, q.destination_url].some(v => String(v || '').toLowerCase().includes(needle))))
    .sort(SORTS[sort][1]);
  const shownKey = shown.map(q => q.id).join();
  const folders = [...new Set(qrCodes.map(q => q.client).filter(Boolean))].sort() as string[];
  const allTags = [...new Set(qrCodes.flatMap(q => q.tags || []))].sort() as string[];
  // A filter whose folder or tag no longer exists would hide everything with no control to clear it.
  useEffect(() => { if (folder && !folders.includes(folder)) setFolder(''); if (tag && !allTags.includes(tag)) setTag(''); }, [qrCodes]);
  // Bulk actions only ever touch what is on screen: a tab or filter change clears the selection.
  useEffect(() => { setSelected(s => (s ? new Set() : s)); }, [tab, folder, tag, search]);
  const noCustomSlug = !!planData && !planData.limits?.custom_slug;

  useEffect(() => {
    shown.forEach(qr => {
      if (qr.kind === 'link') return;
      const canvas = document.getElementById(`thumb-${qr.id}`) as HTMLCanvasElement;
      if (canvas) {
        const content = getQRContent(qr) || SHORT_DOMAIN;

        QRCode.toCanvas(canvas, content, {
          width: 160,
          margin: 1,
          color: {
            dark: qr.style?.dot_color || '#000000',
            light: qr.style?.bg_color || '#FFFFFF'
          }
        }).catch(err => console.error(err));
      }
    });
  }, [shownKey, qrCodes, codesReady]);

  const bar = (h: number, w: string) => <div className="sk" style={{ height: h, width: w }} />;
  const totalScans = Number(Object.values(stats).reduce((sum: number, s: any) => sum + (s.total_scans || 0), 0));
  const uniqueVisitors = Number(Object.values(stats).reduce((sum: number, s: any) => sum + (s.unique_scans || 0), 0));

  return (
    <div className="content" style={{ padding: '28px', overflow: 'auto', height: '100%' }}>
      <div className="page active">
        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">
              <svg className="stat-icon" viewBox="0 0 16 16" fill="var(--coral)"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2a5 5 0 110 10A5 5 0 018 3zm0 2a3 3 0 100 6 3 3 0 000-6z"/></svg>
              Total Scans
            </div>
            <div className="stat-val">{codesReady ? totalScans.toLocaleString() : bar(28, '40%')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">
              <svg className="stat-icon" viewBox="0 0 16 16" fill="var(--blue)"><circle cx="8" cy="6" r="3"/><path d="M3 14c0-2.761 2.239-5 5-5s5 2.239 5 5"/></svg>
              Unique Visitors
            </div>
            <div className="stat-val">{codesReady ? uniqueVisitors.toLocaleString() : bar(28, '40%')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">
              <svg className="stat-icon" viewBox="0 0 16 16" fill="var(--purple)"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
              QR Codes
            </div>
            <div className="stat-val">{codesReady ? qrCodes.filter(q => q.kind !== 'link').length : bar(28, '40%')}</div>
            <span className="stat-change neutral">
              {planData ? `${planData.limits.qr_codes === -1 ? 'Unlimited' : planData.limits.qr_codes} limit` : bar(12, '60px')}
            </span>
          </div>
          <div className="stat-card">
            <div className="stat-label">
              <svg className="stat-icon" viewBox="0 0 16 16" fill="var(--amber)"><path d="M8 1l2 4 5 .7-3.5 3.4.8 5L8 12l-4.3 2.1.8-5L1 5.7 6 5z"/></svg>
              Account Plan
            </div>
            <div className="stat-val" style={{ fontSize: '20px', textTransform: 'uppercase' }}>
              {planData ? planData.plan || 'Free' : bar(20, '70px')}
            </div>
            <span className="stat-change neutral" style={{ cursor: 'pointer', color: 'var(--coral)' }} onClick={() => navigate('/billing')}>
              Upgrade →
            </span>
          </div>
        </div>

        {/* Paste a link: shorten it here, or open the editor with it filled in */}
        <div className="card mb16">
          <div className="card-title">Paste a link</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Link to shorten" className="form-input" style={{ flex: '3 1 260px' }} placeholder="example.com/a-long-link"
              value={pasteUrl} onChange={e => setPasteUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') shorten(); }} />
            <input aria-label="Custom back-half" className={`form-input ${slugProblem(backHalf) ? 'error' : ''}`} style={{ flex: '1 1 150px' }} maxLength={40}
              placeholder={noCustomSlug ? 'Back-half (Pro)' : 'Back-half (optional)'} disabled={noCustomSlug}
              value={backHalf} onChange={e => setBackHalf(e.target.value.trim())} />
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={shorten}>Shorten</button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/create?url=${encodeURIComponent(pasteUrl.trim())}`)}>Make QR code</button>
          </div>
          <LinkCheck check={pasteCheck} onUse={setPasteUrl} />
          {slugProblem(backHalf) ? <div className="error-msg">{slugProblem(backHalf)}</div>
            : noCustomSlug && <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '6px' }}>Pick your own back-half ({shortHost()}/your-name) on <Link to="/billing" style={{ color: 'var(--coral)' }}>Pro</Link>.</div>}
        </div>

        {/* Today's offer on guest pages (Restaurant Kit) */}
        {qrCodes.some(q => q.qr_type === 'page') ? (
          <div className="card mb16">
            <div className="card-title">Today's offer</div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {qrCodes.filter(q => q.qr_type === 'page').map(q => (
                <OfferSwap key={q.slug} qr={q} onSaved={u => setQrCodes(prev => prev.map(p => p.slug === u.slug ? u : p))} />
              ))}
            </div>
          </div>
        ) : (
          <div className="card mb16" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div className="card-title" style={{ marginBottom: '4px' }}>Restaurant Kit</div>
              <div style={{ fontSize: '13px', color: 'var(--text3)' }}>One table QR for your menu, reviews, WhatsApp, Wi-Fi and today's offer — in English, Sinhala and Tamil.</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/kit')}>Set up the kit →</button>
          </div>
        )}

        {/* Chart */}
        <div className="mb24">
          <div className="card">
            <div className="section-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div className="card-title" style={{ marginBottom: '2px', fontSize: '16px' }}>Scan Traffic Over Time</div>
                <div style={{ fontSize: '13px', color: 'var(--text3)' }}>Daily scans and unique visitor trends across your active codes</div>
              </div>
              <div className="scans-seg" role="group" aria-label="Date range">
                {[7, 30, 90].map(n => <button key={n} className={rangeMode === 'days' && days === n ? 'on' : ''} aria-pressed={rangeMode === 'days' && days === n} onClick={() => { setRangeMode('days'); setDays(n); }}>{n} Days</button>)}
                <button className={rangeMode === 'range' ? 'on' : ''} aria-pressed={rangeMode === 'range'} onClick={() => setRangeMode('range')}>Custom</button>
              </div>
            </div>
            {rangeMode === 'range' && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '10px' }}>
                <input aria-label="Start date" type="date" className="form-input" style={{ width: 'auto' }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <span style={{ color: 'var(--text3)' }}>to</span>
                <input aria-label="End date" type="date" className="form-input" style={{ width: 'auto' }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            )}
            <div style={{ height: '280px', width: '100%', marginTop: '16px' }}>
              {timeseries === null ? <div className="sk" style={{ height: '100%' }} /> : <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeseries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E85D3A" stopOpacity={0.3} /><stop offset="100%" stopColor="#E85D3A" stopOpacity={0.02} /></linearGradient>
                    <linearGradient id="gUnique" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3B82F6" stopOpacity={0.2} /><stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} /></linearGradient>
                  </defs>
                  <XAxis dataKey="date" tickFormatter={(d: string) => String(d).slice(5)} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--text3)' }} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text3)' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', background: 'var(--surface)' }}
                    labelStyle={{ color: 'var(--text)' }}
                  />
                  <Area type="monotone" dataKey="total_scans" name="Total Scans" stroke="#E85D3A" strokeWidth={2.5} fill="url(#gTotal)" dot={false} />
                  <Area type="monotone" dataKey="unique_scans" name="Unique Visitors" stroke="#3B82F6" strokeWidth={2} strokeDasharray="4 3" fill="url(#gUnique)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>}
            </div>
          </div>
        </div>

        {/* QR Codes table + Top Countries */}
        <div className="grid-21 mb24">
          <div className="card">
            <div className="section-row" style={{ flexWrap: 'wrap', gap: '8px' }}>
              <div className="dash-tabs" role="tablist">
                {TABS.map(([t, label]) => (
                  <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                    {t === 'link' ? <><span className="tab-full">{label}</span><span className="tab-short">Links</span></> : label}
                    {codesReady && <em>{qrCodes.filter(q => tabOf(q) === t).length}</em>}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {/* ponytail: Select (bulk move, tag, ZIP, delete) is hidden on phones only; drop the class to hide it everywhere. */}
                <button className={`btn btn-ghost btn-sm${selected ? '' : ' hide-mobile'}`} onClick={() => setSelected(selected ? null : new Set())}>{selected ? 'Done' : 'Select'}</button>
                {planData?.limits?.bulk_create && <button className="btn btn-ghost btn-sm" onClick={() => navigate('/bulk')}>Bulk</button>}
                {tab !== 'link' && <button className="btn btn-ghost btn-sm" onClick={() => navigate(tab === 'page' ? '/pages' : tab === 'form' ? '/forms/new' : '/create')}>+ New</button>}
              </div>
            </div>

            <div className="list-tools">
              <input type="search" aria-label="Search" className="form-input" style={{ flex: '1 1 160px' }} placeholder="Search name, link or back-half" value={search} onChange={e => setSearch(e.target.value)} />
              <select aria-label="Sort" className="form-input" value={sort} onChange={e => setSort(e.target.value)}>
                {Object.entries(SORTS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
              </select>
              {folders.length > 0 && (
                <select aria-label="Filter by folder" className="form-input" value={folder} onChange={e => setFolder(e.target.value)}>
                  <option value="">All folders</option>
                  {folders.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {allTags.length > 0 && (
                <select aria-label="Filter by tag" className="form-input" value={tag} onChange={e => setTag(e.target.value)}>
                  <option value="">All tags</option>
                  {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              {folder && (
                <Link className="btn btn-ghost btn-sm" to={`/analytics?folder=${encodeURIComponent(folder)}&slugs=${qrCodes.filter(q => q.client === folder).map(q => q.slug).join(',')}`}>
                  Folder analytics →
                </Link>
              )}
            </div>

            {selected && (
              <div className="select-bar">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '6px' }}>
                  <input type="checkbox" aria-label="Select all shown" checked={shown.length > 0 && shown.every(q => selected.has(q.slug))}
                    onChange={e => setSelected(new Set(e.target.checked ? shown.map(q => q.slug) : []))} />
                  {selected.size} selected
                </label>
                {selected.size > 0 && <>
                  <button className="btn btn-ghost btn-sm" onClick={() => askBulk('folder', 'Move to folder', 'Type a folder name (new or existing). Leave it empty to take the codes out of their folder.', 'Move')}>Move to folder</button>
                  {(planData?.limits?.workspaces ?? 1) > 1 && !planData?.is_member && <button className="btn btn-ghost btn-sm" onClick={() => askBulk('workspace', 'Move to workspace', 'Type the workspace name, or "default" for the default workspace.', 'Move')}>Move to workspace</button>}
                  <button className="btn btn-ghost btn-sm" onClick={() => askBulk('tag', 'Add a tag', 'Type a tag to add to the selected codes.', 'Add tag')}>Add tag</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => bulk('activate')}>Activate</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => bulk('deactivate')}>Deactivate</button>
                  {tab !== 'link' && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={downloadZip}>{busy ? 'Building ZIP…' : 'Download ZIP'}</button>}
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--coral)' }} onClick={() => showModal({
                    type: 'confirm', title: `Delete ${selected.size} code${selected.size === 1 ? '' : 's'}`, isDestructive: true, confirmText: 'Delete permanently',
                    message: 'The selected codes and all their scan history will be deleted. Printed codes will stop working. This cannot be undone.',
                    onConfirm: () => bulk('delete'),
                  })}>Delete</button>
                </>}
              </div>
            )}

            {!codesReady ? (
              <div className="qr-grid">{[0, 1, 2, 3].map(i => <div key={i} className="sk" style={{ height: 150, borderRadius: 16 }} />)}</div>
            ) : shown.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)' }}>
                {needle || folder || tag ? 'Nothing matches these filters.'
                  : tab === 'link' ? 'No short links yet. Paste a link above and press Shorten.'
                  : tab === 'form' ? <>No forms yet. <Link to="/forms/new" style={{ color: 'var(--coral)', textDecoration: 'none' }}>Build your first form</Link>.</>
                  : tab === 'page' ? <>No pages yet. <Link to="/pages" style={{ color: 'var(--coral)', textDecoration: 'none' }}>Build your first page</Link>.</>
                  : <>No QR codes yet. <Link to="/create" style={{ color: 'var(--coral)', textDecoration: 'none' }}>Create your first one</Link>.</>}
              </div>
            ) : (
              <div className="qr-grid">
                {shown.map(qr => {
                  const qrStats = stats[qr.id] || {};
                  const isLink = qr.kind === 'link';
                  let inactiveReason = 'Paused';
                  if (qr.expiry_date && new Date(qr.expiry_date) < new Date()) inactiveReason = 'Expired';
                  if (qr.rate_limit?.enabled && qrStats.total_scans > qr.rate_limit.max_scans) inactiveReason = 'Scan Limit Reached';
                  const shortUrl = isLink ? getQRContent(qr).replace(/^https?:\/\//, '') : `${shortHost()}/${qr.slug}`;
                  const copy = () => navigator.clipboard.writeText(isLink ? getQRContent(qr) : `https://${shortUrl}`).then(() => showToast('success', 'Link copied!'));

                  return (
                    <article className="qr-card" key={qr.id}>
                      <div className="qr-card-top">
                        {selected && (
                          <input type="checkbox" aria-label={`Select ${qr.title || qr.slug}`} checked={selected.has(qr.slug)}
                            onChange={e => setSelected(prev => { const next = new Set(prev); if (e.target.checked) next.add(qr.slug); else next.delete(qr.slug); return next; })} />
                        )}
                        <span className={`status-pill ${qr.is_active !== false ? 'status-active' : 'status-inactive'}`} title={qr.is_active !== false ? 'Active' : inactiveReason}>
                          <i className="dot" />{qr.is_active !== false ? 'Active' : inactiveReason}
                        </span>
                        {qr.is_active !== false && qr.link_status === 'fail' && (
                          <span className="status-pill status-error" title={`${qr.link_reason || 'The destination is not working.'} Edit the code to fix the address.`}>
                            <i className="dot" />Link broken
                          </span>
                        )}
                        <span className="qr-card-type">{qr.content_data?.kind || (isLink ? 'link' : qr.qr_type)}</span>
                        <span className="qr-card-scans" title="Scans"><Activity size={14} />{(qrStats.total_scans || 0).toLocaleString()}</span>
                      </div>
                      <div className="qr-card-main">
                        {!isLink && (
                          <div className="qr-thumb" style={{ cursor: 'pointer' }} title="View QR code" onClick={() => setViewQR(qr)}>
                            <canvas id={`thumb-${qr.id}`} width="160" height="160"></canvas>
                          </div>
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="qr-row-name" title={qr.title || 'Untitled'}>{qr.title || 'Untitled'}</div>
                          <div className="qr-card-slug"><span>{shortUrl}</span><button type="button" aria-label="Copy link" onClick={copy}><Copy size={14} /></button></div>
                          <div className="qr-card-dest">↳ {qr.destination_url}</div>
                          {qrStats.failed_scans > 0 && <div style={{ fontSize: '11px', color: 'var(--coral)', marginTop: '2px' }}>{qrStats.failed_scans.toLocaleString()} failed scans</div>}
                          {(qr.client || qr.tags?.length > 0) && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                              {qr.client && <span className="chip tag-chip" title="Folder">📁 {qr.client}</span>}
                              {(qr.tags || []).map((t: string) => <span key={t} className="chip tag-chip" style={{ cursor: 'pointer' }} onClick={() => setTag(t)}>{t}</span>)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="qr-card-foot">
                        {!isLink && <button type="button" className="qr-card-btn" onClick={() => setViewQR(qr)}><QrCode size={16} />QR Code</button>}
                        <button type="button" className="qr-card-btn" onClick={() => navigate(`/analytics/${qr.slug}`)}><BarChart3 size={16} />Stats</button>
                        <span className="row-actions" style={{ marginLeft: 'auto' }}>
                          {qr.qr_type === 'form' && <IconButton icon={Inbox} label="Responses" onClick={() => navigate(`/forms/${qr.slug}/responses`)} />}
                          <IconButton icon={Pencil} label="Edit" onClick={() => navigate(qr.qr_type === 'page' ? pageEditPath(qr) : qr.qr_type === 'form' ? `/forms/${qr.slug}/edit` : `/edit/${qr.id}`)} />
                          <IconButton icon={Trash2} label="Delete" danger onClick={() => handleDelete(qr.id, qr.slug)} />
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
          <div className="card">
            <div className="card-title">Top countries</div>
            {countries === null ? bar(180, '100%') : <CountryDonut data={countries} />}
          </div>
        </div>

        {/* Live scan stream + scanner platforms */}
        <div className="grid-21">
          <div className="card">
            <div className="section-row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div className="card-title" style={{ marginBottom: '2px', fontSize: '16px' }}>Live Scan Stream</div>
                <div style={{ fontSize: '13px', color: 'var(--text3)' }}>Recent scans across your codes</div>
              </div>
              <span className="status-pill status-active"><i className="dot" />Real-time</span>
            </div>
            <div className="scans-seg scans-limit" role="group" aria-label="Scans to show" style={{ margin: '8px 0' }}>
              {[5, 10, 20, 50].map(n => <button key={n} className={scansShown === n ? 'on' : ''} aria-pressed={scansShown === n} onClick={() => setScansShown(n)}>{n}</button>)}
            </div>
            {recentScans === null ? <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>{[0, 1, 2].map(i => <div key={i} className="sk" style={{ height: 56 }} />)}</div> : recentScans.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)' }}>No recent scans</div>
            ) : (
              <div id="live-feed">
                {recentScans.slice(0, scansShown).map(scan => (
                  <div key={scan.id} className="scan-row">
                    <i><QrCode size={18} /></i>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="scan-row-title">{qrCodes.find(q => q.slug === scan.slug)?.title || scan.slug}</div>
                      <div className="scan-row-sub">{scan.city}, {scan.country} · {scan.device_type} · {scan.browser}</div>
                    </div>
                    <time dateTime={scan.scanned_at}>{new Date(scan.scanned_at).toLocaleString()}</time>
                  </div>
                ))}
              </div>
            )}
            {recentScans && recentScans.length > scansShown && (
              <button className="btn btn-ghost btn-sm scans-more" onClick={() => setScansShown(n => n + 5)}>Show more</button>
            )}
          </div>
          <div className="card platforms">
            <div className="card-title" style={{ marginBottom: '2px', fontSize: '16px' }}>Scanner Platforms</div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '18px' }}>Device breakdown across all scans</div>
            {devices === null ? <div style={{ display: 'grid', gap: 18 }}>{[0, 1, 2].map(i => <div key={i} className="sk" style={{ height: 30 }} />)}</div> : devices.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)' }}>No data</div>
            ) : (() => {
              const total = devices.reduce((n, d) => n + d.count, 0) || 1;
              return devices.map(d => {
                const pct = Math.round((d.count / total) * 100);
                return (
                  <div key={d.device_type} className="plat-row">
                    <div><span>{d.device_type.charAt(0).toUpperCase() + d.device_type.slice(1)}</span><em>{pct}%</em></div>
                    <i><b style={{ width: `${pct}%` }} /></i>
                  </div>
                );
              });
            })()}
            <div className="plat-foot"><span>Based on all your scans</span><Link to="/analytics">Full Analytics →</Link></div>
          </div>
        </div>
      </div>

      {viewQR && <QRViewerModal qr={viewQR} onClose={() => setViewQR(null)} />}
    </div>
  );
}
