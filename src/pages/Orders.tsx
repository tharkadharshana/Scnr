// Orders of one restaurant (page) QR: a board for the kitchen, a list with filters and CSV, and simple stats. Polls every 15 s while the tab is visible.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useUI } from '../shared/UIContext';
import { supabase } from '../supabase';
import { money } from '../lib/designs';
import { canMove, FLOW, OPEN } from '../lib/orders';
import { shortHost } from '../lib/qrContent';
import QrTabs from '../components/QrTabs';

const LABEL: Record<string, string> = { new: 'New', accepted: 'Accepted', cooking: 'Cooking', ready: 'Ready', delivered: 'Served', cancelled: 'Cancelled', rejected: 'Rejected' };
const NEXT: Record<string, [string, string]> = { new: ['accepted', 'Accept'], accepted: ['cooking', 'Start cooking'], cooking: ['ready', 'Mark ready'], ready: ['delivered', 'Mark served'] };
const POLL_MS = 15000;
const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(iso).toLocaleDateString(); };
const sum = (o: any) => money(String(o.total), o.currency) || String(o.total);

export default function Orders() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { showToast } = useUI();
  const [qr, setQr] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ used: number; limit: number }>({ used: 0, limit: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'board' | 'list' | 'stats'>('board');
  const [fStatus, setFStatus] = useState(''); const [fPaid, setFPaid] = useState(''); const [fType, setFType] = useState('');
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState<string[]>([]); // ids with a change in flight
  const [failed, setFailed] = useState(false);
  const [ok, setOk] = useState(false); // a load has succeeded (so a first load that failed never counts as "everything is new")
  const seen = useRef<Set<string> | null>(null);
  const gen = useRef(0); // bumped by every change, so a poll that started before it cannot put the old status back

  const load = useCallback(async () => {
    const g = gen.current;
    try {
      // The newest 100, plus every open order however old, so the board never loses one behind a busy day.
      const [r, open] = await Promise.all([apiFetch(`/api/orders/${slug}?limit=100`), apiFetch(`/api/orders/${slug}?open=1&limit=100`)]);
      if (g !== gen.current) return; // an owner's change landed meanwhile: this answer may be older than it
      const fresh = [...new Map([...r.orders, ...open.orders].map((o: any) => [o.id, o])).values()].sort((a: any, b: any) => Date.parse(b.created_at) - Date.parse(a.created_at));
      const oldest = Date.parse(r.orders[r.orders.length - 1]?.created_at || '0');
      setOrders(prev => { // keep older pages the owner already loaded
        const ids = new Set(fresh.map((o: any) => o.id));
        return [...fresh, ...prev.filter(o => !ids.has(o.id) && Date.parse(o.created_at) < oldest)];
      });
      setMore(r.orders.length === 100);
      setMeta({ used: r.month_used, limit: r.month_limit });
      setFailed(false); setOk(true);
    } catch { setFailed(true); /* the next poll tries again */ }
    setLoading(false);
  }, [slug]);

  useEffect(() => { apiFetch(`/api/qr/${slug}`).then(setQr).catch(() => showToast('error', 'Could not load this page')); }, [slug]);
  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    const vis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [load]);

  const fresh = orders.filter(o => o.status === 'new').length;
  useEffect(() => { // new orders show in the browser tab title, and a first load does not count as "new"
    const base = document.title.replace(/^\(\d+\) /, '');
    document.title = fresh ? `(${fresh}) ${base}` : base;
    return () => { document.title = base; };
  }, [fresh]);
  useEffect(() => { if (ok) { const ids = new Set(orders.map(o => o.id)); if (seen.current && orders.some(o => o.status === 'new' && !seen.current!.has(o.id) && Date.now() - Date.parse(o.created_at) < 600000)) showToast('success', 'New order!'); seen.current = ids; } }, [orders, ok]);

  const change = async (o: any, patch: { status?: string; paid?: boolean }) => {
    gen.current++; setBusy(b => [...b, o.id]);
    try { const u = await apiFetch(`/api/orders/${o.id}`, { method: 'PATCH', body: JSON.stringify(patch) }); gen.current++; setOrders(p => p.map(x => (x.id === u.id ? u : x))); }
    catch (e: any) { gen.current++; showToast('error', e?.message || 'Could not update the order'); load(); }
    setBusy(b => b.filter(x => x !== o.id));
  };
  const setOrdering = async (on: boolean) => {
    try { const cur = await apiFetch(`/api/qr/${slug}`); const content_data = { ...cur.content_data, orders: { on } }; // re-read first, so a menu edit saved meanwhile is not overwritten
      await apiFetch(`/api/qr/${slug}`, { method: 'PUT', body: JSON.stringify({ title: cur.title, content_data }) }); setQr({ ...cur, content_data }); showToast('success', on ? 'Guests can order now' : 'Ordering is off'); }
    catch (e: any) { showToast('error', e?.message || 'Could not change this'); }
  };
  const older = async () => {
    const last = orders[orders.length - 1]; if (!last) return;
    try {
      const r = await apiFetch(`/api/orders/${slug}?limit=100&before=${encodeURIComponent(last.created_at)}`);
      setOrders(p => [...p, ...r.orders.filter((o: any) => !p.some(x => x.id === o.id))]); setMore(r.orders.length === 100);
    } catch { showToast('error', 'Could not load older orders'); }
  };
  const csv = async () => { // the server's export: up to 10,000 orders, not just the ones on screen
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch(`/api/orders/${slug}/export.csv`, { headers: { Authorization: `Bearer ${session?.access_token}` } });
    if (!r.ok) return showToast('error', 'Could not download the orders');
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = `orders-${slug}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const place = (o: any) => (o.type === 'dine_in' ? `Table ${o.table_no}` : `Takeaway${o.pickup_time ? ` · ${o.pickup_time}` : ''}`);
  const lines = (o: any) => (o.items || []).map((l: any, i: number) => <div key={i} className="ord-line">{l.qty} × {l.name}</div>);

  const card = (o: any) => {
    const next = NEXT[o.status], open = (OPEN as string[]).includes(o.status);
    return (
      <div key={o.id} className={`ord-card st-${o.status}`}>
        <div className="ord-top"><b className="ord-code">{o.code}</b><span>{ago(o.created_at)}</span></div>
        <div className="ord-place">{place(o)}</div>
        <div className="ord-who">{o.name} · <a href={`tel:${String(o.phone).replace(/[^\d+]/g, '')}`}>{o.phone}</a></div>
        <div className="ord-lines">{lines(o)}</div>
        {o.note && <div className="ord-note">“{o.note}”</div>}
        <div className="ord-total"><span>{sum(o)}</span><span className={o.paid ? 'paid' : 'unpaid'}>{o.paid ? 'Paid' : 'Not paid'}</span></div>
        <div className="ord-acts">
          {next && <button className="btn btn-primary btn-sm" disabled={busy.includes(o.id)} onClick={() => change(o, { status: next[0] })}>{next[1]}</button>}
          {!['cancelled', 'rejected'].includes(o.status) && <button className="btn btn-ghost btn-sm" disabled={busy.includes(o.id)} onClick={() => change(o, { paid: !o.paid })}>{o.paid ? 'Unpay' : 'Mark paid'}</button>}
          {open && <button className="btn btn-ghost btn-sm" disabled={busy.includes(o.id)} onClick={() => change(o, { status: o.status === 'new' ? 'rejected' : 'cancelled' })}>{o.status === 'new' ? 'Reject' : 'Cancel'}</button>}
        </div>
      </div>
    );
  };

  const board = useMemo(() => {
    const cut = Date.now() - 2 * 3600000;
    return FLOW.map(s => ({ s, rows: orders.filter(o => o.status === s && (s !== 'delivered' || Date.parse(o.updated_at) > cut)).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)) }));
  }, [orders]);

  const shown = orders.filter(o => (!fStatus || o.status === fStatus) && (!fPaid || o.paid === (fPaid === '1')) && (!fType || o.type === fType));

  const stats = useMemo(() => { // from the orders loaded here (the latest 100 unless "Load older" was used)
    const live = orders.filter(o => !['cancelled', 'rejected'].includes(o.status));
    const money_ = (xs: any[]) => xs.reduce((a, o) => a + Number(o.total), 0);
    const items: Record<string, number> = {}; for (const o of live) for (const l of o.items || []) items[l.name] = (items[l.name] || 0) + l.qty;
    const days: Record<string, number> = {}; for (const o of live) { const d = new Date(o.created_at).toLocaleDateString('en-CA'); days[d] = (days[d] || 0) + 1; }
    const byStatus: Record<string, number> = {}; for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    return { count: live.length, paid: money_(live.filter(o => o.paid)), unpaid: money_(live.filter(o => !o.paid)), avg: live.length ? money_(live) / live.length : 0, byStatus,
      top: Object.entries(items).sort((a, b) => b[1] - a[1]).slice(0, 8), days: Object.entries(days).sort().slice(-7) };
  }, [orders]);
  const cur = orders[0]?.currency || qr?.content_data?.blocks?.find((b: any) => b.kind === 'menu')?.currency || '';
  const fm = (n: number) => money(String(Math.round(n * 100) / 100), cur) || String(Math.round(n * 100) / 100);

  const on = !!qr?.content_data?.orders?.on;
  return (
    <div className="content" style={{ padding: '28px', overflow: 'auto', height: '100%' }}>
      <div className="page active">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>← Back</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-h)', fontSize: '20px', fontWeight: 600, color: 'var(--text)' }}>{qr?.title || slug}</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{shortHost()}/{slug}</div>
          </div>
          <QrTabs slug={slug} active="orders" />
        </div>

        {qr && !on && (
          <div className="card mb16" style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div><div className="card-title" style={{ marginBottom: '4px' }}>Ordering is off</div><div style={{ fontSize: '13px', color: 'var(--text3)' }}>Guests see the menu only. Turn it on to let them add items, enter their name and phone, and order from their seat or for takeaway.</div></div>
            <button className="btn btn-primary btn-sm" onClick={() => setOrdering(true)}>Let guests order</button>
          </div>
        )}
        {qr && on && meta.limit > 0 && (
          <div className="ord-meta"><span>{meta.used} of {meta.limit} orders this month</span>{meta.used >= meta.limit && <b>Limit reached: guests can see the menu but cannot order. <a href="/billing">See plans</a></b>}
            <button className="btn btn-ghost btn-sm" onClick={() => setOrdering(false)}>Turn ordering off</button></div>
        )}

        <div className="ord-bar">
          <div className="fb-tabs">
            {(['board', 'list', 'stats'] as const).map(v => <button key={v} aria-pressed={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{v === 'board' ? 'Board' : v === 'list' ? 'List' : 'Stats'}</button>)}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={csv} disabled={!orders.length}>Download CSV</button>
        </div>

        {loading ? <div className="card" style={{ color: 'var(--text3)' }}>Loading orders…</div>
          : !orders.length && failed ? <div className="card" style={{ textAlign: 'center', color: '#b42318', padding: '40px 16px' }}>Could not load orders. Retrying…</div>
          : !orders.length ? <div className="card" style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 16px' }}>No orders yet. They appear here by themselves within seconds of a guest placing one.</div>
          : view === 'board' ? (
            <div className="ord-board">{board.map(c => (
              <div key={c.s} className="ord-col"><div className="ord-col-h"><b>{LABEL[c.s]}</b><span>{c.rows.length}</span></div>{c.rows.length ? c.rows.map(card) : <div className="ord-empty">Nothing here</div>}</div>
            ))}</div>
          ) : view === 'list' ? (
            <div className="card">
              <div className="ord-filters">
                <select aria-label="Status" value={fStatus} onChange={e => setFStatus(e.target.value)}><option value="">All statuses</option>{Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <select aria-label="Paid" value={fPaid} onChange={e => setFPaid(e.target.value)}><option value="">Paid or not</option><option value="1">Paid</option><option value="0">Not paid</option></select>
                <select aria-label="Type" value={fType} onChange={e => setFType(e.target.value)}><option value="">Dine-in and takeaway</option><option value="dine_in">Dine-in</option><option value="takeaway">Takeaway</option></select>
              </div>
              <div className="qr-table-wrap"><table className="qr-table">
                <thead><tr><th>Code</th><th>When</th><th>Where</th><th>Guest</th><th>Items</th><th>Total</th><th>Status</th><th>Paid</th></tr></thead>
                <tbody>{shown.map(o => (
                  <tr key={o.id}>
                    <td><b>{o.code}</b></td><td>{ago(o.created_at)}</td><td>{place(o)}</td>
                    <td>{o.name}<div style={{ fontSize: '12px' }}><a href={`tel:${String(o.phone).replace(/[^\d+]/g, '')}`}>{o.phone}</a></div></td>
                    <td>{lines(o)}</td><td>{sum(o)}</td>
                    <td><select aria-label="Change status" value={o.status} disabled={busy.includes(o.id) || !(OPEN as string[]).includes(o.status)} onChange={e => change(o, { status: e.target.value })}>
                      <option value={o.status}>{LABEL[o.status]}</option>
                      {Object.keys(LABEL).filter(s => s !== o.status && canMove(o.status, s)).map(s => <option key={s} value={s}>{LABEL[s]}</option>)}
                    </select></td>
                    <td><input type="checkbox" aria-label="Paid" checked={o.paid} disabled={busy.includes(o.id) || ['cancelled', 'rejected'].includes(o.status)} onChange={e => change(o, { paid: e.target.checked })} /></td>
                  </tr>))}
                </tbody></table></div>
              {more && <div style={{ textAlign: 'center', marginTop: '12px' }}><button className="btn btn-ghost btn-sm" onClick={older}>Load older orders</button></div>}
            </div>
          ) : (
            <>
              <div className="ord-stats">
                <div className="card"><div className="stat-label">Orders</div><div className="stat-value">{stats.count}</div></div>
                <div className="card"><div className="stat-label">Paid</div><div className="stat-value">{fm(stats.paid)}</div></div>
                <div className="card"><div className="stat-label">Not paid yet</div><div className="stat-value">{fm(stats.unpaid)}</div></div>
                <div className="card"><div className="stat-label">Average order</div><div className="stat-value">{fm(stats.avg)}</div></div>
              </div>
              <div className="ord-stats2">
                <div className="card"><div className="card-title">Top items</div>{stats.top.length ? stats.top.map(([n, q]) => <div key={n} className="ord-bar-row"><span>{n}</span><i style={{ width: `${Math.max(6, (q / stats.top[0][1]) * 100)}%` }} /><b>{q}</b></div>) : <div style={{ color: 'var(--text3)' }}>No items yet</div>}</div>
                <div className="card"><div className="card-title">Orders per day</div>{stats.days.map(([d, n]) => <div key={d} className="ord-bar-row"><span>{d.slice(5)}</span><i style={{ width: `${Math.max(6, (n / Math.max(...stats.days.map(x => x[1]))) * 100)}%` }} /><b>{n}</b></div>)}
                  <div className="card-title" style={{ marginTop: '14px' }}>By status</div>{Object.entries(stats.byStatus).map(([s, n]) => <div key={s} className="ord-bar-row"><span>{LABEL[s]}</span><b>{n}</b></div>)}</div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)' }}>From the {orders.length} orders loaded. Cancelled and rejected orders are not counted. Use “Load older orders” in the List to include more.</div>
            </>
          )}
      </div>
    </div>
  );
}
