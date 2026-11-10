import React, { useEffect, useRef, useState } from 'react';

/** Small SVG charts (lines or areas, bars, donut) that replace recharts: about 115 KB gzip less on every chart page. */

const PAD = { l: 40, r: 12, t: 8, b: 22 };

/** Round the top of an axis up to a friendly step (1, 1.5, 2, 2.5, 3, 4, 5 x 10^n, at least 1) and give four steps. */
export function niceScale(max: number, steps = 4): { max: number; step: number } {
  const raw = Math.max(max, 1) / steps;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = Math.max(1, Math.ceil(([1, 1.5, 2, 2.5, 3, 4, 5, 10].find(c => c >= f) || 10) * pow)); // whole numbers only: these are counts
  return { max: step * steps, step };
}

/** Smooth path through the points (cubic curve with horizontal handles at the midpoints). */
export function curvePath(pts: [number, number][]): string {
  if (!pts.length) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2;
    d += `C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  return d;
}

function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const axisText: React.CSSProperties = { fontSize: 11, fill: 'var(--text3)' };
const tipBox: React.CSSProperties = {
  position: 'absolute', top: 4, pointerEvents: 'none', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap', color: 'var(--text)', zIndex: 2,
};

type Series = { key: string; name: string; color: string; dash?: string; area?: boolean };

/** Lines (optionally filled) over a shared x axis, with hover readout. `x` formats the axis labels, `title` the tooltip heading. */
export function SeriesChart({ data, xKey, series, height = 200, x = String, title = String }: {
  data: any[]; xKey: string; series: Series[]; height?: number; x?: (v: any) => string; title?: (v: any) => string;
}) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const uid = useRef('g' + Math.random().toString(36).slice(2, 7)).current;
  const n = data.length;
  const scale = niceScale(Math.max(0, ...data.flatMap(d => series.map(s => Number(d[s.key]) || 0))));
  const iw = Math.max(w - PAD.l - PAD.r, 1), ih = height - PAD.t - PAD.b;
  const px = (i: number) => PAD.l + (n > 1 ? (i / (n - 1)) * iw : iw / 2);
  const py = (v: number) => PAD.t + ih - (v / scale.max) * ih;
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / 64))));
  const move = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(n > 1 ? Math.min(n - 1, Math.max(0, Math.round(((e.clientX - r.left - PAD.l) / iw) * (n - 1)))) : 0);
  };
  const row = hover !== null ? data[hover] ?? null : null; // data can shrink while the pointer is still over the chart
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height }}>
      {w > 0 && n > 0 && (
        <svg width={w} height={height} onMouseMove={move} onMouseLeave={() => setHover(null)} role="img"
          aria-label={`${series.map(s => s.name).join(' and ')} over ${n} points, from ${title(data[0][xKey])} to ${title(data[n - 1][xKey])}. Latest: ${series.map(s => `${s.name} ${(Number(data[n - 1][s.key]) || 0).toLocaleString()}`).join(', ')}`}>
          <defs>
            {series.filter(s => s.area).map((s, i) => (
              <linearGradient key={s.key} id={`${uid}${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} /><stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          {Array.from({ length: 5 }, (_, i) => i * scale.step).map(v => (
            <g key={v}>
              <line x1={PAD.l} x2={w - PAD.r} y1={py(v)} y2={py(v)} stroke="var(--border)" strokeDasharray="3 3" />
              <text x={PAD.l - 8} y={py(v) + 4} textAnchor="end" style={axisText}>{v}</text>
            </g>
          ))}
          {data.map((d, i) => i % every === 0 && <text key={i} x={px(i)} y={height - 6} textAnchor="middle" style={axisText}>{x(d[xKey])}</text>)}
          {series.map((s, si) => {
            const pts = data.map((d, i) => [px(i), py(Number(d[s.key]) || 0)] as [number, number]);
            const line = curvePath(pts);
            return (
              <g key={s.key}>
                {s.area && n > 1 && <path d={`${line}L${pts[n - 1][0]},${py(0)}L${pts[0][0]},${py(0)}Z`} fill={`url(#${uid}${series.filter(q => q.area).indexOf(s)})`} />}
                <path d={line} fill="none" style={{ stroke: s.color }} strokeWidth={s.area ? 2.5 : 2} strokeDasharray={s.dash} strokeLinecap="round" />
              </g>
            );
          })}
          {n === 1 && series.map(s => <circle key={s.key} cx={px(0)} cy={py(Number(data[0][s.key]) || 0)} r={4} style={{ fill: s.color }} />)}
          {hover !== null && row && (
            <g>
              <line x1={px(hover)} x2={px(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--border2)" />
              {series.map(s => <circle key={s.key} cx={px(hover)} cy={py(Number(row[s.key]) || 0)} r={4} style={{ fill: s.color }} stroke="var(--surface)" strokeWidth={2} />)}
            </g>
          )}
        </svg>
      )}
      {row && (
        <div style={{ ...tipBox, ...(px(hover!) > w / 2 ? { right: w - px(hover!) + 12 } : { left: px(hover!) + 12 }) }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{title(row[xKey])}</div>
          {series.map(s => <div key={s.key} style={{ color: s.color }}>{s.name}: {(Number(row[s.key]) || 0).toLocaleString()}</div>)}
        </div>
      )}
    </div>
  );
}

/** Vertical bars, one per row (for example scans by hour). */
export function BarsChart({ data, xKey, yKey, name = 'scans', color = '#E85D3A', height = 160, x = String, title = String }: {
  data: any[]; xKey: string; yKey: string; name?: string; color?: string; height?: number; x?: (v: any) => string; title?: (v: any) => string;
}) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const n = data.length;
  const scale = niceScale(Math.max(0, ...data.map(d => Number(d[yKey]) || 0)));
  const iw = Math.max(w - PAD.l - PAD.r, 1), ih = height - PAD.t - PAD.b, slot = iw / Math.max(n, 1);
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / 36))));
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height }}>
      {w > 0 && n > 0 && (
        <svg width={w} height={height} onMouseLeave={() => setHover(null)} role="img"
          aria-label={`${name} by ${xKey}: ${data.map(d => `${title(d[xKey])} ${Number(d[yKey]) || 0}`).join(', ')}`}>
          {Array.from({ length: 5 }, (_, i) => i * scale.step).map(v => {
            const y = PAD.t + ih - (v / scale.max) * ih;
            return <g key={v}><line x1={PAD.l} x2={w - PAD.r} y1={y} y2={y} stroke="var(--border)" strokeDasharray="3 3" /><text x={PAD.l - 8} y={y + 4} textAnchor="end" style={axisText}>{v}</text></g>;
          })}
          {data.map((d, i) => {
            const h = ((Number(d[yKey]) || 0) / scale.max) * ih;
            return (
              <g key={i} onMouseEnter={() => setHover(i)}>
                <rect x={PAD.l + i * slot} y={PAD.t} width={slot} height={ih} fill="transparent" />
                <rect x={PAD.l + i * slot + slot * 0.15} y={PAD.t + ih - h} width={slot * 0.7} height={h} rx={3} fill={color} opacity={hover === null || hover === i ? 1 : 0.55} />
                {i % every === 0 && <text x={PAD.l + i * slot + slot / 2} y={height - 6} textAnchor="middle" style={axisText}>{x(d[xKey])}</text>}
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <div style={{ ...tipBox, ...(hover > n / 2 ? { right: w - (PAD.l + hover * slot) + 4 } : { left: PAD.l + (hover + 1) * slot + 4 }) }}>
          <div style={{ fontWeight: 600 }}>{title(data[hover][xKey])}</div>
          <div style={{ color }}>{(Number(data[hover][yKey]) || 0).toLocaleString()} {name}</div>
        </div>
      )}
    </div>
  );
}

/** Ring made of stroke segments; each segment has a native hover title. */
export function Ring({ values, colors, unit = 'scans', size = 140 }: { values: { name: string; value: number }[]; colors: string[]; unit?: string; size?: number }) {
  const total = values.reduce((n, v) => n + v.value, 0) || 1;
  const r = size * 0.32, c = 2 * Math.PI * r, gap = values.length > 1 ? 3 : 0;
  let used = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={values.map(v => `${v.name} ${v.value.toLocaleString()} ${unit}`).join(', ')}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {values.map((v, i) => {
          const len = Math.max((v.value / total) * c - gap, 0.5), off = used;
          used += (v.value / total) * c;
          return (
            <circle key={v.name} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors[i % colors.length]} strokeWidth={size * 0.17}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off}>
              <title>{`${v.name}: ${v.value.toLocaleString()} ${unit}`}</title>
            </circle>
          );
        })}
      </g>
    </svg>
  );
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('charts.tsx')) {
  const assert = (ok: boolean, msg: string) => { if (!ok) throw new Error('charts self-check failed: ' + msg); };
  assert(niceScale(0).max === 4 && niceScale(7).max === 8 && niceScale(497).max === 600 && niceScale(1140).max === 1200, 'niceScale');
  assert(curvePath([]) === '' && curvePath([[0, 0], [10, 10]]) === 'M0,0C5,0 5,10 10,10', 'curvePath');
  console.log('charts self-check ok');
}
