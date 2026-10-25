import React from 'react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';

export const PIE_COLORS = ['#E85D3A', '#4D9EFF', '#3DCC7E', '#9B7FFF', '#F5A623', '#9CA3AF'];
const TOP = 5;

const regionName = (() => {
  try { const n = new Intl.DisplayNames(['en'], { type: 'region' }); return (c: string) => { try { return n.of(c) || c; } catch { return c; } }; } catch { return (c: string) => c; }
})();

/** Scans by country as a donut: the top five countries, the rest grouped as Other, with a legend of name, count and share. */
export default function CountryDonut({ data }: { data: { country: string; scans: number }[] }) {
  const sorted = [...data].filter(d => d.scans > 0).sort((a, b) => b.scans - a.scans);
  const rows = sorted.slice(0, TOP).map(d => ({ name: regionName(d.country), scans: d.scans }));
  const rest = sorted.slice(TOP).reduce((n, d) => n + d.scans, 0);
  if (rest) rows.push({ name: 'Other', scans: rest });
  const total = rows.reduce((n, d) => n + d.scans, 0);
  if (!total) return <div className="donut-empty">No geographic data yet</div>;
  return (
    <div className="donut-wrap">
      <div className="donut-chart">
        <PieChart width={140} height={140}>
          <Pie data={rows} dataKey="scans" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={rows.length > 1 ? 2 : 0} stroke="none">
            {rows.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: any, n: any) => [`${v} scans`, n]} />
        </PieChart>
        <div className="donut-center"><b>{total.toLocaleString()}</b><span>scans</span></div>
      </div>
      <ul className="donut-legend">
        {rows.map((r, i) => (
          <li key={r.name}>
            <i style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span>{r.name}</span>
            <em>{r.scans.toLocaleString()} · {Math.round((r.scans / total) * 100)}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
