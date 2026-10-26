// Pure parts of the destination link check: turning a response into a verdict, the www/apex variant, and reading the page head.
// The network side lives in server/linkCheck.ts. Shared by the browser (types) and the server (relative imports end in .js).
export type LinkStatus = 'ok' | 'warn' | 'fail';
/** What POST /api/link-check returns. */
export type LinkInfo = { status: LinkStatus; reason: string; code: number | null; ms: number; finalUrl: string; redirected: boolean; title: string | null; favicon: string | null; suggestion?: string };
export type LinkVerdict = { status: LinkStatus; reason: string };

/** Verdict for one HTTP answer. `blocked` is a bot-protection header (Cloudflare's cf-mitigated). */
export function classify(code: number, blocked = false): LinkVerdict {
  if (code >= 200 && code < 400) return { status: 'ok', reason: 'Reachable' };
  if (blocked || [401, 403, 429, 999].includes(code)) return { status: 'warn', reason: 'This site blocks automated checks, so we could not verify it. It may still work for visitors.' };
  if (code === 404 || code === 410) return { status: 'fail', reason: 'Page not found (404). Check the address.' };
  if (code >= 500) return { status: 'warn', reason: `The site answered with an error (${code}). It may be down for a moment.` };
  return { status: 'warn', reason: `The site answered with ${code}.` };
}

/** Verdict for a connection failure (Node error code). */
export function classifyError(code?: string): LinkVerdict {
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return { status: 'fail', reason: 'That domain does not exist or has no DNS record.' };
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET') return { status: 'fail', reason: 'The site refused the connection.' };
  if (code === 'ETIMEDOUT' || code === 'TIMEOUT') return { status: 'fail', reason: 'The site took too long to answer.' };
  if (code === 'BLOCKED') return { status: 'fail', reason: 'That address points to a private network, so it cannot be a public link.' };
  if (code === 'PORT') return { status: 'warn', reason: 'Only standard web ports (80 and 443) can be checked, so we could not verify it.' };
  if (code === 'REDIRECTS') return { status: 'fail', reason: 'The link redirects too many times.' };
  if (code && /CERT|SSL|TLS|ERR_TLS|DEPTH_ZERO|UNABLE_TO_VERIFY/i.test(code)) return { status: 'fail', reason: 'The site has a broken security certificate.' };
  return { status: 'fail', reason: 'We could not connect to that address.' };
}

/** The same address with `www.` added or removed, or null for an IP, a deeper subdomain or no change. */
export function variantOf(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const parts = u.hostname.split('.');
  if (u.hostname.startsWith('www.')) u.hostname = u.hostname.slice(4);
  else if (parts.length === 2 || (parts.length === 3 && parts[1].length <= 3 && parts[2].length === 2)) u.hostname = `www.${u.hostname}`; // bni.lk, shop.co.uk; not a.b.example.com
  else return null;
  return u.toString();
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();

/** Page title and favicon from the first bytes of HTML. The favicon is an absolute https/http URL or null. */
export function parseHead(html: string, base: string): { title: string | null; favicon: string | null } {
  const t = /<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(html);
  const title = t ? decode(t[1]).slice(0, 120) || null : null;
  let favicon: string | null = null;
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!/rel\s*=\s*["']?[^"'>]*\bicon\b/i.test(m[0])) continue;
    const h = /href\s*=\s*["']([^"']+)["']/i.exec(m[0]);
    if (!h) continue;
    try { const f = new URL(decode(h[1]), base); if (/^https?:$/.test(f.protocol)) { favicon = f.toString(); break; } } catch { /* skip a bad href */ }
  }
  if (!favicon) { try { favicon = new URL('/favicon.ico', base).toString(); } catch { /* leave null */ } }
  return { title, favicon };
}

/** One assert-based self-check; run with: npx tsx src/lib/linkCheck.ts */
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('linkCheck.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  assert(classify(200).status === 'ok' && classify(302).status === 'ok', '2xx/3xx ok');
  assert(classify(403).status === 'warn' && classify(429).status === 'warn' && classify(200, true).status === 'ok' && classify(503, true).status === 'warn', 'bot walls warn');
  assert(classify(404).status === 'fail' && classify(410).status === 'fail', '404 fails');
  assert(classify(500).status === 'warn' && classify(418).status === 'warn', '5xx and odd codes warn');
  assert(classifyError('ENOTFOUND').status === 'fail' && classifyError().status === 'fail' && classifyError('BLOCKED').reason.includes('private'), 'errors fail');
  assert(variantOf('https://bni.lk/a?b=1') === 'https://www.bni.lk/a?b=1', 'add www');
  assert(variantOf('https://www.bni.lk') === 'https://bni.lk/', 'drop www');
  assert(variantOf('https://a.b.example.com') === null && variantOf('https://1.2.3.4') === null && variantOf('nope') === null, 'no variant');
  const h = parseHead('<html><head><title> Hi &amp; bye </title><link rel="shortcut icon" href="/i.png"></head>', 'https://x.lk/p');
  assert(h.title === 'Hi & bye' && h.favicon === 'https://x.lk/i.png', `head ${JSON.stringify(h)}`);
  assert(parseHead('<p>no head</p>', 'https://x.lk/p').favicon === 'https://x.lk/favicon.ico' && parseHead('', 'https://x.lk').title === null, 'defaults');
  assert(parseHead('<link rel="icon" href="javascript:alert(1)">', 'https://x.lk').favicon === 'https://x.lk/favicon.ico', 'bad favicon scheme ignored');
  console.log('linkCheck.ts self-check ok');
}
