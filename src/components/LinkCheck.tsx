import React from 'react';
import type { LinkInfo } from '../lib/linkCheck';

const host = (u: string) => { try { return new URL(u).hostname; } catch { return u; } };

/** Status line and preview under a destination input. Never blocks saving: the caller decides what to do with a failure. */
export default function LinkCheck({ check, onUse }: { check: { loading: boolean; data: LinkInfo | null }; onUse?: (url: string) => void }) {
  const { loading, data } = check;
  if (loading && !data) return <div className="link-check link-checking" role="status"><span className="link-spin" aria-hidden="true" />Checking the link…</div>;
  if (!data) return null;
  const icon = data.status === 'ok' ? '✓' : data.status === 'warn' ? '!' : '✕';
  return (
    <div className={`link-check link-${data.status}`} role="status">
      <div className="link-line">
        <b aria-hidden="true">{icon}</b>
        <span>{data.status === 'ok' ? `Reachable · ${(data.ms / 1000).toFixed(1)} s${data.redirected ? ` · redirects to ${host(data.finalUrl)}` : ''}` : data.reason}</span>
      </div>
      {data.suggestion && onUse && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => onUse(data.suggestion!)}>
          This works instead: use {host(data.suggestion)}
        </button>
      )}
      {data.status === 'ok' && (data.title || data.favicon) && (
        <div className="link-card">
          {data.favicon && <img src={data.favicon} alt="" width={16} height={16} referrerPolicy="no-referrer" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
          <span>{data.title || host(data.finalUrl)}</span>
          <em>{host(data.finalUrl)}</em>
        </div>
      )}
    </div>
  );
}
