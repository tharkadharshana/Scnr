import React from 'react';

const box = (h: number, key?: number) => <div key={key} className="sk" style={{ height: h }} />;

/** A few shimmering rows for lists and tables that are still loading. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return <div className="card" aria-busy="true" aria-label="Loading" style={{ display: 'grid', gap: 10 }}>{Array.from({ length: rows }, (_, i) => box(56, i))}</div>;
}

/** Whole-page placeholder: a stat row, one big box and a list. Shown while a page's data loads, so nobody stares at a white screen. */
export default function PageSkeleton() {
  return (
    <div className="content" aria-busy="true" aria-label="Loading" style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
      <div className="stats-row" style={{ marginBottom: 0 }}>{[0, 1, 2, 3].map(i => box(88, i))}</div>
      {box(260)}
      {[0, 1, 2].map(i => box(64, i))}
    </div>
  );
}

/** First paint, before the app knows who is signed in: sidebar and page boxes in theme colours. */
export function ShellSkeleton() {
  return (
    <div className="app-shell">
      <div className="sidebar" aria-hidden="true" style={{ display: 'grid', gap: 12, alignContent: 'start', padding: 16 }}>{[0, 1, 2, 3, 4, 5].map(i => box(36, i))}</div>
      <div className="main"><PageSkeleton /></div>
    </div>
  );
}

const line = (h: number, w: string, mt = 0) => <div className="sk" style={{ height: h, width: w, marginTop: mt }} />;

/** The Dashboard's own shape (same classes as the real page), so nothing jumps when the data arrives. */
export function DashboardSkeleton() {
  return (
    <div className="content" aria-busy="true" aria-label="Loading" style={{ padding: '28px', overflow: 'auto', height: '100%' }}>
      <div className="page active">
        <div className="stats-row">
          {[0, 1, 2, 3].map(i => <div key={i} className="stat-card">{line(12, '55%')}{line(28, '40%', 14)}</div>)}
        </div>
        <div className="card mb16">{line(14, '120px')}{line(40, '100%', 12)}</div>
        <div className="mb24"><div className="card">{line(18, '220px')}{line(280, '100%', 16)}</div></div>
        <div className="grid-21 mb24">
          <div className="card">
            {line(32, '60%')}
            <div className="qr-grid">{[0, 1, 2, 3].map(i => <div key={i} className="sk" style={{ height: 150, borderRadius: 16 }} />)}</div>
          </div>
          <div className="card">{line(14, '110px')}{line(180, '100%', 14)}</div>
        </div>
      </div>
    </div>
  );
}
