import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { SeriesChart, BarsChart } from '../components/charts';
import { supabase } from '../supabase';
import { apiFetch, formatNumber } from '../lib/api';
import { shortHost } from '../lib/qrContent';
import QRViewerModal from '../components/QRViewerModal';
import { TrackingCards } from '../components/GeoMap';
import CountryDonut, { DeviceDonut } from '../components/CountryDonut';

const COLORS = ['#1A1916', '#E85D3A', '#4D9EFF', '#3DCC7E', '#9B7FFF', '#F5A623', '#D0021B'];

export default function Analytics() {
  const { planData } = useOutletContext<{ planData: any }>();
  const { slug: initialSlug } = useParams();
  const navigate = useNavigate();
  const [qrCodes, setQrCodes] = useState<any[]>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(initialSlug ? [initialSlug] : []);
  const [showMultiSelect, setShowMultiSelect] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [timeseries, setTimeseries] = useState<any[]>([]);
  const [rangeMode, setRangeMode] = useState<'days' | 'range'>('days');
  const [days, setDays] = useState(planData?.limits?.analytics_days || 30);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [devices, setDevices] = useState<any[] | null>(null); // null = still loading: each block shows a skeleton until its own data arrives
  const [countries, setCountries] = useState<any[] | null>(null);
  const [browsers, setBrowsers] = useState<any[] | null>(null);
  const [osData, setOsData] = useState<any[] | null>(null);
  const [recentScans, setRecentScans] = useState<any[] | null>(null);
  const [hours, setHours] = useState<any[] | null>(null);
  const [qrDetails, setQrDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [viewQR, setViewQR] = useState<any | null>(null);
  const [clicks, setClicks] = useState<any[]>([]);

  // Pages: clicks per button, social link and product (Engagements card).
  useEffect(() => {
    setClicks([]);
    if (qrDetails?.qr_type === 'page') apiFetch(`/api/analytics/${qrDetails.slug}/clicks`).then(d => setClicks(Array.isArray(d) ? d : [])).catch(() => {});
  }, [qrDetails?.slug, qrDetails?.qr_type]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    const fetchQRs = async () => {
      try {
        if (!userId) return;
        const data = await apiFetch('/api/qr?lite=1');
        setQrCodes(data);
      } catch (error) {
        console.error("Error fetching QRs:", error);
      }
    };
    fetchQRs();
  }, [userId]);

  const fetchTimeseries = async () => {
    if (!userId) return;
    try {
      let baseUrl = `/api/analytics/account/${userId}`;
      let queryParams = '';

      if (selectedSlugs.length === 1) {
        baseUrl = `/api/analytics/${selectedSlugs[0]}`;
      } else if (selectedSlugs.length > 1) {
        queryParams = `slugs=${selectedSlugs.join(',')}`;
      }

      let tsUrl = `${baseUrl}/timeseries`;
      let params = [];
      if (queryParams) params.push(queryParams);
      
      if (rangeMode === 'days') {
        params.push(`days=${days}`);
      } else if (startDate && endDate) {
        params.push(`start=${startDate}`);
        params.push(`end=${endDate}`);
      } else {
        return;
      }

      tsUrl += `?${params.join('&')}`;
      const data = await apiFetch(tsUrl);
      setTimeseries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch timeseries", err);
    }
  };

  useEffect(() => {
    fetchTimeseries();
  }, [selectedSlugs, userId, days, rangeMode, startDate, endDate]);

  useEffect(() => {
    let alive = true; // a slower, older selection must not overwrite a newer one
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        if (!userId) {
          console.log("No user found, waiting...");
          return;
        }

        let baseUrl = `/api/analytics/account/${userId}`;
        let queryParams = '';

        if (selectedSlugs.length === 1) {
          baseUrl = `/api/analytics/${selectedSlugs[0]}`;
        } else if (selectedSlugs.length > 1) {
          queryParams = `?slugs=${selectedSlugs.join(',')}`;
        }

        // Each request paints its block as soon as it returns; nothing waits for the slowest one.
        const rows = (set: (v: any[]) => void) => (d: any) => { if (alive) set(Array.isArray(d) ? d : []); };
        const get = (path: string, set: (v: any[]) => void) => apiFetch(`${baseUrl}/${path}${queryParams}`).catch(() => []).then(rows(set));
        const jobs: Promise<any>[] = [
          apiFetch(`${baseUrl}/summary${queryParams}`).then(d => alive && setSummary(d)).catch(() => alive && setSummary({})),
          get('devices', setDevices), get('countries', setCountries), get('browsers', setBrowsers),
          get('os', setOsData), get('recent', setRecentScans), get('hours', setHours),
          selectedSlugs.length === 1 ? apiFetch(`/api/qr/${selectedSlugs[0]}`).then(d => alive && setQrDetails(d)).catch(() => alive && setQrDetails(null)) : Promise.resolve(setQrDetails(null)),
        ];
        await Promise.all(jobs);
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
    return () => { alive = false; };
  }, [selectedSlugs, userId]);

  const toggleSlug = (slug: string) => {
    setSelectedSlugs(prev => {
      if (prev.includes(slug)) {
        return prev.filter(s => s !== slug);
      } else {
        return [...prev, slug];
      }
    });
  };

  const bar = (h: number, w = '40%') => <div className="sk" style={{ height: h, width: w }} />;

  // One code: raw scans as CSV from the API. Several codes: the daily series built here.
  const downloadCsv = async () => {
    let blob: Blob;
    if (selectedSlugs.length === 1) {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`/api/analytics/${selectedSlugs[0]}/events.csv`, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      if (!r.ok) return;
      blob = await r.blob();
    } else {
      const lines = ['date,total_scans,unique_scans', ...timeseries.map(d => `${d.date},${d.total_scans},${d.unique_scans}`)];
      blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = selectedSlugs.length === 1 ? `scans-${selectedSlugs[0]}.csv` : 'scans-daily.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const peak = hours?.length ? hours.reduce((m, h) => (h.scans > m.scans ? h : m), hours[0]) : null;

  return (
    <div className="content" style={{ padding: '28px', overflow: 'auto', height: '100%' }}>
      <div className="page active">
        {/* Printed report header: the agency's own name/logo on Team (white-label), else Scnr. */}
        <div className="print-only" style={{ alignItems: 'center', gap: '12px', marginBottom: '16px', color: '#16171b' }}>
          {planData?.profile?.agencyLogo && <img src={planData.profile.agencyLogo} alt="" style={{ height: '40px' }} />}
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>{planData?.profile?.agencyName || 'Scnr'} · scan report</div>
            <div style={{ fontSize: '12px' }}>{new Date().toLocaleDateString()}</div>
          </div>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <button className="btn btn-ghost btn-sm" onClick={downloadCsv}>Download CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>Print report</button>
        </div>
        <div className="analytics-header-row" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', position: 'relative', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
            <div>
              <div style={{ fontFamily: 'var(--font-h)', fontSize: '20px', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.3px' }}>
                {qrDetails?.title || (selectedSlugs.length === 1 ? selectedSlugs[0] : 'Analytics')}
              </div>
              {selectedSlugs.length === 1 && (
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>
                  {shortHost()}/{selectedSlugs[0]}
                </div>
              )}
            </div>
            {selectedSlugs.length === 1 && qrDetails && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setViewQR(qrDetails)}
                title="View & download QR code"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
                </svg>
                View QR
              </button>
            )}
          </div>
          
          <div className="analytics-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '100%', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
              <button 
                className="btn btn-outline btn-sm"
                onClick={() => setShowMultiSelect(!showMultiSelect)}
                style={{ width: '100%', justifyContent: 'space-between' }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedSlugs.length === 0 ? 'All QR Codes' : 
                   selectedSlugs.length === 1 ? (qrCodes.find(q => q.slug === selectedSlugs[0])?.title || selectedSlugs[0]) :
                   `${selectedSlugs.length} QRs Selected`}
                </span>
                <span style={{ marginLeft: '8px' }}>▼</span>
              </button>

              {showMultiSelect && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 100,
                  width: '240px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  padding: '8px'
                }}>
                  <div 
                    style={{ padding: '8px', borderBottom: '1px solid var(--border)', marginBottom: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                    onClick={() => {
                      setSelectedSlugs([]);
                      setShowMultiSelect(false);
                    }}
                  >
                    Select All
                  </div>
                  {qrCodes.map(qr => (
                    <label key={qr.slug} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', cursor: 'pointer', fontSize: '13px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedSlugs.includes(qr.slug)}
                        onChange={() => toggleSlug(qr.slug)}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {qr.title || qr.slug}
                      </span>
                    </label>
                  ))}
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                    <button className="btn btn-primary btn-xs" onClick={() => setShowMultiSelect(false)}>Done</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading && <div style={{ position: 'absolute', top: '80px', right: '40px', fontSize: '12px', color: 'var(--coral)' }}>Updating...</div>}

        {/* Big stats */}
        <div className="stats-row mb24">
          <div className="stat-card">
            <div className="stat-label">Total scans</div>
            <div className="stat-val">{summary ? summary.total_scans?.toLocaleString() || 0 : bar(28)}</div>
            <span className="stat-change up">↑ 0%</span>
          </div>
          <div className="stat-card">
            <div className="stat-label">Unique visitors</div>
            <div className="stat-val">{summary ? summary.unique_visitors?.toLocaleString() || 0 : bar(28)}</div>
            <span className="stat-change up">↑ 0%</span>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg scans / day</div>
            <div className="stat-val">{!summary ? bar(28) : (() => {
              const total = summary?.total_scans || 0;
              if (!total) return 0;
              const days = summary?.first_scan
                ? Math.max(1, Math.ceil((Date.now() - new Date(summary.first_scan + 'T00:00').getTime()) / 86400000))
                : 1;
              return Math.round(total / days).toLocaleString();
            })()}</div>
            <span className="stat-change up">↑ 0%</span>
          </div>
          <div className="stat-card">
            <div className="stat-label">Mobile Scans</div>
            <div className="stat-val">{summary ? `${summary.mobile_pct || 0}%` : bar(28)}</div>
            <span className="stat-change neutral">--</span>
          </div>
        </div>

        {/* Line chart + Countries */}
        <div className="grid-21 mb16">
          <div className="card">
            <div className="section-row" style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select 
                  aria-label="Date range type"
                  className="btn btn-ghost btn-sm" 
                  value={rangeMode} 
                  onChange={(e) => setRangeMode(e.target.value as any)}
                  style={{ fontSize: '11px' }}
                >
                  <option value="days">Last X Days</option>
                  <option value="range">Custom Range</option>
                </select>

                {rangeMode === 'days' ? (
                  <select 
                    aria-label="Number of days"
                    className="btn btn-ghost btn-sm" 
                    value={days} 
                    onChange={(e) => setDays(Number(e.target.value))}
                    style={{ fontSize: '11px' }}
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                ) : (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <input 
                      aria-label="Start date"
                      type="date" 
                      className="btn btn-ghost btn-sm" 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{ fontSize: '11px', padding: '2px 6px' }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text3)' }}>to</span>
                    <input 
                      aria-label="End date"
                      type="date" 
                      className="btn btn-ghost btn-sm" 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)}
                      style={{ fontSize: '11px', padding: '2px 6px' }}
                    />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text3)' }}>
                  <span style={{ width: '10px', height: '2px', background: 'var(--coral)', display: 'inline-block', borderRadius: '1px' }}></span>Total
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text3)' }}>
                  <span style={{ width: '10px', height: '2px', background: 'var(--blue)', display: 'inline-block', borderRadius: '1px' }}></span>Unique
                </span>
              </div>
            </div>
            <div style={{ height: '200px', position: 'relative', marginTop: '16px', minHeight: '200px', minWidth: 0 }}>
              {timeseries.length === 0 ? (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '13px', background: 'var(--surface2)', borderRadius: '4px' }}>
                  No scan data found for this period
                </div>
              ) : (
                <SeriesChart data={timeseries} xKey="date" height={200} x={(v: string) => { const d = new Date(v + 'T00:00'); return `${d.getMonth() + 1}/${d.getDate()}`; }} title={(v: string) => v}
                  series={[{ key: 'total_scans', name: 'Total', color: '#E85D3A' }, { key: 'unique_scans', name: 'Unique', color: '#4D9EFF' }]} />
              )}
            </div>
          </div>
          <div className="card mb16">
            <div className="card-title">Busiest hours <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 400 }}>· all time, UTC{peak && peak.scans > 0 ? ` · peak ${String(peak.hour).padStart(2, '0')}:00` : ''}</span></div>
            <div style={{ height: '160px', marginTop: '12px' }}>
              {hours === null ? <div className="sk" style={{ height: '100%' }} /> : hours.every(h => !h.scans) ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '12px', background: 'var(--surface2)', borderRadius: '4px' }}>Hour-of-day data starts with new scans</div>
              ) : (
                <BarsChart data={hours} xKey="hour" yKey="scans" height={160} x={(h: number) => String(h)} title={(h: number) => `${String(h).padStart(2, '0')}:00`} />
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-title">Top countries</div>
            {countries === null ? bar(180, '100%') : <CountryDonut data={countries} />}
          </div>
        </div>

        {/* Heatmap + Browsers */}
        <div className="grid-2 mb16">
          <div className="card">
            <div className="section-title mb16">Devices <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 400 }}>· all time</span></div>
            <div>
              <div>
                <div className="card-title">Device</div>
                {devices === null ? bar(180, '100%') : <DeviceDonut data={devices} />}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="section-title mb16">Browser & OS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div className="card-title">Browser</div>
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {browsers === null ? bar(90, '100%') : browsers.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text3)' }}>No browser data available.</p>
                  ) : (
                    browsers.slice(0, 5).map((b, i) => (
                      <div key={b.browser} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[i % COLORS.length] }}></div>
                          <span style={{ color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }} title={b.browser}>{b.browser}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 500 }}>{b.count}</span>
                          <span style={{ color: 'var(--text3)', width: '30px', textAlign: 'right' }}>{b.pct}%</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div>
                <div className="card-title">OS</div>
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {osData === null ? bar(90, '100%') : osData.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text3)' }}>No OS data available.</p>
                  ) : (
                    osData.slice(0, 5).map((os, i) => (
                      <div key={os.os} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[(i+3) % COLORS.length] }}></div>
                          <span style={{ color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }} title={os.os}>{os.os}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 500 }}>{os.count}</span>
                          <span style={{ color: 'var(--text3)', width: '30px', textAlign: 'right' }}>{os.pct}%</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {qrDetails?.qr_type === 'page' && (
          <div className="card mb16">
            <div className="section-row"><span className="section-title">Engagements</span></div>
            <div className="qr-table-wrap">
              <table className="qr-table">
                <thead><tr><th>Link</th><th>Clicks</th><th>CTR</th></tr></thead>
                <tbody>
                  {clicks.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)' }}>No clicks yet</td></tr>
                  ) : clicks.map(c => (
                    <tr key={c.key}>
                      <td title={c.url}>{c.label}</td>
                      <td>{formatNumber(c.clicks)}</td>
                      <td>{Number(c.ctr || 0).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {userId && (selectedSlugs.length === 1
          ? <TrackingCards base={`/api/analytics/${selectedSlugs[0]}`} />
          : <TrackingCards base={`/api/analytics/account/${userId}`} query={selectedSlugs.length > 1 ? `?slugs=${selectedSlugs.join(',')}` : ''} />)}

        {/* Recent Scans Table */}
        <div className="card">
          <div className="section-row">
            <span className="section-title">Recent Scans</span>
          </div>
          <div className="qr-table-wrap">
            <table className="qr-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Location</th>
                  <th>Device</th>
                  <th>Browser/OS</th>
                  <th>Referrer</th>
                  <th>Unique</th>
                </tr>
              </thead>
              <tbody>
                {recentScans === null ? (
                  <tr><td colSpan={6} style={{ padding: '12px' }}>{bar(48, '100%')}</td></tr>
                ) : recentScans.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)' }}>
                      No recent scans found.
                    </td>
                  </tr>
                ) : (
                  recentScans.map((scan) => (
                    <tr key={scan.id}>
                      <td>{new Date(scan.scanned_at).toLocaleString()}</td>
                      <td>{scan.city !== 'Unknown' ? `${scan.city}, ` : ''}{scan.country}</td>
                      <td style={{ textTransform: 'capitalize' }}>{scan.device_type}</td>
                      <td>{scan.browser} / {scan.os}</td>
                      <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scan.referrer}</td>
                      <td>
                        <span className={`status-pill ${scan.is_unique ? 'status-active' : 'status-inactive'}`}>
                          {scan.is_unique ? 'Yes' : 'No'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      {viewQR && <QRViewerModal qr={viewQR} onClose={() => setViewQR(null)} />}
    </div>
  );
}
