// Network side of the destination link check. Verdict logic is in src/lib/linkCheck.ts.
// SSRF: the address is checked when the socket connects (custom lookup), so a name that later resolves to a private IP cannot slip through,
// and every redirect hop goes through the same check.
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import { classify, classifyError, parseHead, variantOf, type LinkInfo } from '../src/lib/linkCheck.js';

export type LinkResult = LinkInfo;

const blocked = new net.BlockList();
for (const [a, p] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4]] as const) blocked.addSubnet(a, p, 'ipv4');
for (const [a, p] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) blocked.addSubnet(a, p, 'ipv6');

/** True for any address that is not a public internet address. Loopback is allowed only under NODE_ENV=test (QA's local server). */
export function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (!family) return true;
  if (process.env.NODE_ENV === 'test' && (ip === '127.0.0.1' || ip === '::1')) return false;
  return blocked.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}

const err = (code: string) => Object.assign(new Error(code), { code });

// The lookup Node calls before connecting: resolve, refuse if any answer is private, hand back only the checked answers.
const safeLookup = ((host: string, opts: any, cb: any) => {
  dns.lookup(host, { all: true }, (e, addrs) => {
    if (e) return cb(e);
    if (!addrs.length || addrs.some(a => isBlockedIp(a.address))) return cb(err('BLOCKED'));
    if (opts?.all) cb(null, addrs); else cb(null, addrs[0].address, addrs[0].family);
  });
}) as any;

const MAX_BYTES = 64 * 1024;
const once = (u: URL, signal: AbortSignal) => new Promise<{ code: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
  const lib = u.protocol === 'https:' ? https : http;
  const req = lib.request(u, { method: 'GET', lookup: safeLookup, signal, headers: { 'User-Agent': 'ScnrLinkCheck/1.0 (+https://scnr.tharkak.com)', Accept: 'text/html,*/*;q=0.5' } }, res => {
    const html = /html/i.test(String(res.headers['content-type'] || ''));
    const parts: Buffer[] = []; let n = 0;
    const done = () => resolve({ code: res.statusCode || 0, headers: res.headers, body: Buffer.concat(parts).toString('utf8') });
    if (!html || (res.statusCode || 0) >= 300) { req.destroy(); return done(); }
    res.on('data', (c: Buffer) => { parts.push(c); n += c.length; if (n >= MAX_BYTES || /<\/head>/i.test(c.toString('latin1'))) { req.destroy(); done(); } });
    res.on('end', done);
    res.on('error', done);
  });
  req.on('error', e => reject(signal.aborted ? err('TIMEOUT') : e));
  req.end();
});

async function probe(url: string): Promise<LinkResult> {
  const t0 = Date.now();
  const signal = AbortSignal.timeout(5000);
  const fail = (code: string | undefined, cur: string): LinkResult => ({ ...classifyError(code), code: null, ms: Date.now() - t0, finalUrl: cur, redirected: cur !== url, title: null, favicon: null });
  let cur = url;
  try {
    for (let hop = 0; hop <= 5; hop++) {
      const u = new URL(cur);
      if (!/^https?:$/.test(u.protocol)) return fail('BLOCKED', cur);
      if (process.env.NODE_ENV !== 'test' && u.port && !['80', '443'].includes(u.port)) return fail('PORT', cur);
      const lit = u.hostname.replace(/^\[|\]$/g, '');
      if (net.isIP(lit) && isBlockedIp(lit)) return fail('BLOCKED', cur); // an IP literal skips the lookup, so check it here
      const r = await once(u, signal);
      const loc = r.code >= 300 && r.code < 400 ? r.headers.location : null;
      if (loc) { cur = new URL(loc, u).toString(); continue; }
      const { status, reason } = classify(r.code, !!r.headers['cf-mitigated']);
      const head = status === 'ok' ? parseHead(r.body, cur) : { title: null, favicon: null };
      return { status, reason, code: r.code, ms: Date.now() - t0, finalUrl: cur, redirected: cur !== url, ...head };
    }
    return fail('REDIRECTS', cur);
  } catch (e: any) {
    return fail(e?.code || e?.cause?.code, cur);
  }
}

// ponytail: per-instance cache (serverless instances do not share it); a shared cache only matters if one URL is hammered.
const cache = new Map<string, { at: number; val: LinkResult }>();

/** Checks one address. When it is not fine, tries the same address with www added or removed and suggests that one if it works. */
export async function checkLink(url: string): Promise<LinkResult> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < 60_000) return hit.val;
  const val = await probe(url);
  if (val.status !== 'ok') {
    const alt = variantOf(url);
    if (alt && (await probe(alt)).status === 'ok') val.suggestion = alt;
  }
  if (cache.size > 500) cache.clear();
  cache.set(url, { at: Date.now(), val });
  return val;
}

/** One assert-based self-check; run with: npx tsx server/linkCheck.ts */
if (process.argv?.[1]?.endsWith('linkCheck.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  for (const ip of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.5.5', '172.31.255.255', '192.168.1.1', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fc00::1', '::ffff:10.0.0.1', '::ffff:127.0.0.1', 'nope']) assert(isBlockedIp(ip), `${ip} must be blocked`);
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '104.21.49.229', '2606:4700:3035::ac43:c35b']) assert(!isBlockedIp(ip), `${ip} must be allowed`);
  console.log('server/linkCheck.ts self-check ok');
}
