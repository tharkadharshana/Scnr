import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
import { Download } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { supabase } from '../supabase';
import { useUI } from '../shared/UIContext';

// Admin: every account with its plan, usage and the features it uses. Read-only; data from /api/admin/customers.
const STATUS: Record<string, [string, string]> = { paid: ['Paid', 'var(--green)'], trial: ['Trial', 'var(--blue)'], free: ['Free', 'var(--text3)'], lapsed: ['Lapsed', 'var(--red)'] };
const SORTS: Record<string, [string, (a: any, b: any) => number]> = {
  scans: ['Most scans', (a, b) => b.scans.total - a.scans.total],
  month: ['Scans this month', (a, b) => b.scans.month - a.scans.month],
  codes: ['Most codes', (a, b) => (b.codes.total + b.codes.pages + b.codes.forms + b.codes.links) - (a.codes.total + a.codes.pages + a.codes.forms + a.codes.links)],
  newest: ['Newest', (a, b) => String(b.created_at).localeCompare(String(a.created_at))],
  active: ['Last scan', (a, b) => String(b.last_scan_at || '').localeCompare(String(a.last_scan_at || ''))],
};
const day = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : '—');

export default function AdminCustomers() {
  const { planData } = useOutletContext<{ planData?: any }>();
  const { showToast } = useUI();
  const [d, setD] = useState<any | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('scans');
  const [shown, setShown] = useState(25);
  const [open, setOpen] = useState('');
  const [detail, setDetail] = useState<any | null>(null);

  useEffect(() => {
    if (planData?.is_admin) apiFetch('/api/admin/customers').then(setD).catch(() => { setD({ summary: null, customers: [] }); showToast('error', 'Could not load customers'); });
  }, [planData?.is_admin]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (d?.customers || []).filter((c: any) => (!status || c.status === status) && (!needle || `${c.email} ${c.company}`.toLowerCase().includes(needle))).sort(SORTS[sort][1]);
  }, [d, q, status, sort]);
  useEffect(() => setShown(25), [q, status, sort]);
  if (planData && !planData.is_admin) return <Navigate to="/" replace />;

  const toggle = (uid: string) => {
    if (open === uid) return setOpen('');
    setOpen(uid); setDetail(null);
    apiFetch(`/api/admin/customers/${uid}`).then(setDetail).catch(() => { setDetail({ codes: [], subscriptions: [], recent_scans: [] }); showToast('error', 'Could not load the account'); });
  };
  // The CSV needs the sign-in header, so it is fetched and saved as a file instead of being a plain link.
  const csv = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/admin/customers.csv', { headers: { Authorization: `Bearer ${session?.access_token}` } });
    if (!res.ok) return showToast('error', 'Could not export');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await res.blob()); a.download = 'customers.csv'; a.click(); URL.revokeObjectURL(a.href);
  };

  const s = d?.summary;
  const kpi = (label: string, value: string, sub = '') => <div className="stat-card"><div className="stat-label">{label}</div><div className="stat-value" style={{ fontSize: '24px' }}>{value}</div>{sub && <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{sub}</div>}</div>;
  const feats = (c: any) => [c.features.api_keys && `${c.features.api_keys} API key${c.features.api_keys > 1 ? 's' : ''}`, c.features.webhooks && `${c.features.webhooks} webhook${c.features.webhooks > 1 ? 's' : ''}`, c.features.custom_domains && `${c.features.custom_domains} domain${c.features.custom_domains > 1 ? 's' : ''}`, c.features.members && `${c.features.members} member${c.features.members > 1 ? 's' : ''}`].filter(Boolean).join(', ') || '—';

  return (
    <div className="content" style={{ padding: '28px', overflow: 'auto', height: '100%' }}>
      <div className="page active" style={{ maxWidth: '1200px' }}>
        <div className="section-row">
          <span className="section-title">Customers</span>
          <button className="btn btn-ghost btn-sm" onClick={csv} aria-label="Download CSV" title="Download CSV"><Download size={16} aria-hidden="true" /> CSV</button>
        </div>
        {!d ? <div className="card">Loading…</div> : (<>
          {s && <div className="stats-row" style={{ marginBottom: '16px' }}>
            {kpi('Accounts', String(s.accounts), `${s.paid} paid · ${s.trial} trial · ${s.free} free · ${s.lapsed} lapsed`)}
            {kpi('Monthly revenue', `$${s.mrr_usd}`, 'paid plans at USD list price')}
            {kpi('Scans this month', s.scans_month.toLocaleString(), `${s.scans_total.toLocaleString()} all time`)}
            {kpi('Codes', s.codes.toLocaleString(), 'QR codes, pages, forms, links')}
          </div>}

          <div className="list-tools">
            <input type="search" aria-label="Search accounts" className="form-input" style={{ flex: '1 1 200px' }} placeholder="Search email or company" value={q} onChange={e => setQ(e.target.value)} />
            <select aria-label="Status" className="form-input" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(STATUS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <select aria-label="Sort" className="form-input" value={sort} onChange={e => setSort(e.target.value)}>
              {Object.entries(SORTS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>

          <div className="card mb16 qr-table-wrap">
            <table className="qr-table stack">
              <thead><tr><th>Account</th><th>Plan</th><th>Codes</th><th>Scans</th><th>Features</th><th>Joined</th></tr></thead>
              <tbody>
                {rows.slice(0, shown).map((c: any) => (<React.Fragment key={c.uid}>
                  <tr onClick={() => toggle(c.uid)} style={{ cursor: 'pointer' }}>
                    <td><div className="qr-row-name">{c.email || c.uid.slice(0, 8)}</div><div className="qr-row-slug">{[c.company, c.country].filter(Boolean).join(' · ')}</div></td>
                    <td>
                      <span className="status-pill" style={{ background: 'var(--surface2)', color: STATUS[c.status][1] }}><i className="dot" />{STATUS[c.status][0]}</span>
                      <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '3px' }}>{c.plan}{c.status === 'trial' ? ` · ends ${day(c.trial_ends)}` : c.status === 'paid' ? ` · to ${day(c.plan_ends)}` : ''}{c.provider ? ` · ${c.provider}` : ''}</div>
                    </td>
                    <td data-label="Codes">{c.codes.total}/{c.limits.qr_codes} <span style={{ color: 'var(--text3)', fontSize: '11px' }}>({c.codes.dynamic}/{c.limits.dynamic_qr_codes} dynamic)</span><div style={{ fontSize: '11px', color: 'var(--text3)' }}>{c.codes.pages} pages · {c.codes.forms} forms · {c.codes.links} links</div></td>
                    <td data-label="Scans"><b>{c.scans.total.toLocaleString()}</b><div style={{ fontSize: '11px', color: 'var(--text3)' }}>{c.scans.month.toLocaleString()} this month ({c.limits.monthly_scans.toLocaleString()} cap) · {c.scans.last_30_days.toLocaleString()} in 30 days · last {day(c.last_scan_at)}</div></td>
                    <td data-label="Features" style={{ fontSize: '12px' }}>{feats(c)}</td>
                    <td data-label="Joined">{day(c.created_at)}</td>
                  </tr>
                  {open === c.uid && (
                    <tr><td colSpan={6}>
                      {!detail ? 'Loading…' : (<div style={{ display: 'grid', gap: '14px' }}>
                        <div><div className="card-title">Codes ({detail.codes.length})</div>
                          <table className="qr-table stack"><thead><tr><th>Title</th><th>Type</th><th>Mode</th><th>Scans</th><th>Status</th><th>Created</th></tr></thead>
                            <tbody>{detail.codes.slice(0, 50).map((x: any) => (
                              <tr key={x.slug}><td>{x.title || 'Untitled'} <span style={{ color: 'var(--text3)', fontFamily: 'monospace', fontSize: '11px' }}>{x.slug}</span></td><td>{x.kind === 'link' ? 'short link' : x.qr_type}</td><td>{x.is_dynamic ? 'dynamic' : 'static'}</td><td>{x.scans.toLocaleString()}</td><td>{x.is_active ? 'active' : 'paused'}</td><td>{day(x.created_at)}</td></tr>
                            ))}</tbody></table></div>
                        {detail.subscriptions.length > 0 && <div><div className="card-title">Payments</div>
                          <table className="qr-table stack"><thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Provider</th><th>Interval</th><th>Status</th></tr></thead>
                            <tbody>{detail.subscriptions.map((x: any, i: number) => (
                              <tr key={i}><td>{day(x.created_at)}</td><td>{x.plan}</td><td>{x.amount ? `${x.currency} ${x.amount}` : '—'}</td><td>{x.provider}</td><td>{x.interval || '—'}</td><td>{x.status}</td></tr>
                            ))}</tbody></table></div>}
                        {detail.recent_scans.length > 0 && <div><div className="card-title">Latest scans</div>
                          {detail.recent_scans.map((x: any, i: number) => <div key={i} style={{ fontSize: '12px', color: 'var(--text2)', padding: '3px 0' }}>{new Date(x.scanned_at).toLocaleString()} · {x.slug} · {[x.city, x.country].filter(Boolean).join(', ')} · {x.device} · {x.browser}</div>)}</div>}
                      </div>)}
                    </td></tr>
                  )}
                </React.Fragment>))}
                {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px' }}>No accounts match.</td></tr>}
              </tbody>
            </table>
            {rows.length > shown && <button className="btn btn-ghost btn-sm" style={{ margin: '12px auto 0', display: 'block' }} onClick={() => setShown(n => n + 25)}>Show more ({rows.length - shown} left)</button>}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text3)' }}>Account emails and usage are visible to admins only. Revenue counts each paid plan at its monthly USD list price; it is a guide, not an invoice.</p>
        </>)}
      </div>
    </div>
  );
}
