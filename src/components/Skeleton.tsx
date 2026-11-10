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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>{[0, 1, 2, 3].map(i => box(88, i))}</div>
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
