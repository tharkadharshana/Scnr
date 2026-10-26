// Daily link health: how one check result changes a code's counters, and the alert email. Pure (no I/O).
import type { LinkStatus } from './linkCheck.js';

export type Health = { link_status: LinkStatus | null; link_fail_count: number; link_notified_at: string | null };
/** Two failed checks in a row before anyone is emailed: one bad night (a deploy, a blip) is not an outage. */
export const FAILS_BEFORE_ALERT = 2;

/**
 * New counters after a check. `warn` (a site that blocks bots, a 5xx) changes nothing but the verdict: it never counts as a
 * failure, so it can never trigger an email. `alert` is true exactly once per incident.
 */
export function nextHealth(prev: Health, status: LinkStatus, nowIso: string): { next: Health; alert: boolean } {
  if (status === 'ok') return { next: { link_status: 'ok', link_fail_count: 0, link_notified_at: null }, alert: false };
  if (status === 'warn') return { next: { link_status: 'warn', link_fail_count: prev.link_status === 'fail' ? prev.link_fail_count : 0, link_notified_at: prev.link_notified_at }, alert: false };
  const count = prev.link_fail_count + 1;
  const alert = count >= FAILS_BEFORE_ALERT && !prev.link_notified_at;
  return { next: { link_status: 'fail', link_fail_count: count, link_notified_at: alert ? nowIso : prev.link_notified_at }, alert };
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** One email per owner listing their broken codes. */
export function buildLinkAlert(i: { businessName: string; broken: { slug: string; title: string; destination: string; reason: string }[]; appUrl: string }) {
  const n = i.broken.length;
  const subject = n === 1 ? `A link in your QR code is not working: ${i.broken[0].title || i.broken[0].slug}` : `${n} of your QR codes point at links that are not working`;
  const items = i.broken.map(b => `<li style="margin-bottom:8px"><b>${esc(b.title || b.slug)}</b><br><span style="color:#55565c">${esc(b.destination)}</span><br><span style="color:#c0392b">${esc(b.reason)}</span></li>`).join('');
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;color:#16171b">
    <h2 style="margin:0 0 12px">${esc(i.businessName || 'Link check')}</h2>
    <p>Scnr checks the web address behind each dynamic code every day. These failed twice in a row:</p><ul style="padding-left:18px">${items}</ul>
    <p>Fix the address and the printed code works again, no reprint needed.</p>
    <p><a href="${esc(i.appUrl)}/" style="background:#E85D3A;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open dashboard</a></p>
    <p style="font-size:12px;color:#77787e">You get this once per problem. Turn off emails in Settings.</p></div>`;
  return { subject, html };
}

/** One assert-based self-check; run with: npx tsx src/lib/linkHealth.ts */
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('linkHealth.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  const fresh: Health = { link_status: null, link_fail_count: 0, link_notified_at: null };
  const f1 = nextHealth(fresh, 'fail', 'T1');
  assert(f1.next.link_fail_count === 1 && !f1.alert && f1.next.link_notified_at === null, 'first failure: counted, no alert');
  const f2 = nextHealth(f1.next, 'fail', 'T2');
  assert(f2.alert && f2.next.link_notified_at === 'T2' && f2.next.link_fail_count === 2, 'second failure alerts once');
  const f3 = nextHealth(f2.next, 'fail', 'T3');
  assert(!f3.alert && f3.next.link_notified_at === 'T2' && f3.next.link_fail_count === 3, 'third failure does not alert again');
  const w = nextHealth(f1.next, 'warn', 'T');
  assert(!w.alert && w.next.link_fail_count === 1 && w.next.link_status === 'warn', 'warn during a failure streak keeps the count, never alerts');
  assert(nextHealth(fresh, 'warn', 'T').next.link_fail_count === 0, 'warn from clean stays at 0');
  const ok = nextHealth(f2.next, 'ok', 'T4');
  assert(ok.next.link_fail_count === 0 && ok.next.link_notified_at === null && ok.next.link_status === 'ok', 'recovery resets');
  assert(nextHealth(ok.next, 'fail', 'T5').next.link_fail_count === 1 && !nextHealth(ok.next, 'fail', 'T5').alert, 'new incident starts again at 1');
  const m = buildLinkAlert({ businessName: 'A <b>', broken: [{ slug: 's', title: '<i>x</i>', destination: 'https://a.lk/?a=1&b=2', reason: 'Page not found' }], appUrl: 'https://scnr.tharkak.com' });
  assert(!m.html.includes('<i>x') && !m.html.includes('A <b>') && m.html.includes('&amp;b=2') && m.subject.includes('not working'), 'alert email escapes');
  assert(buildLinkAlert({ businessName: '', broken: [{ slug: 'a', title: '', destination: 'u', reason: 'r' }, { slug: 'b', title: '', destination: 'u', reason: 'r' }], appUrl: '' }).subject.startsWith('2 of'), 'plural subject');
  console.log('linkHealth.ts self-check ok');
}
