// Turns whatever a person types into a full web address: "google.com", "www.google.com" and "https://google.com" all work.
// Shared by the browser and the server (relative imports in the server graph end in .js).
const ALLOWED = ['http:', 'https:'];

export function normalizeUrl(input: unknown): { ok: boolean; url: string; error?: string } {
  const raw = String(input ?? '').trim();
  const bad = (error = "That doesn't look like a website. Try something like google.com") => ({ ok: false, url: raw, error });
  if (!raw || /\s/.test(raw)) return bad();
  let text = raw;
  if (text.startsWith('//')) text = `https:${text}`;
  else if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    // A scheme with no slashes (javascript:, data:, mailto:) is never a bare domain; host:port/path is.
    if (/^[a-z][a-z0-9+.-]*:(?!\d+(\/|$))/i.test(text)) return bad();
    text = `https://${text}`;
  }
  let u: URL;
  try { u = new URL(text); } catch { return bad(); }
  if (!ALLOWED.includes(u.protocol)) return bad();
  const host = u.hostname;
  // A real host has a dot and a TLD of two or more letters (punycode TLDs included); localhost and bare IPs are not accepted.
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:[a-z]{2,}|xn--[a-z0-9-]+)$/i.test(host)) return bad();
  // Keep what the person typed (plus the scheme we added), so an already-valid link is stored exactly as before.
  return { ok: true, url: text };
}

/** For fields that may already hold any scheme (https://, tel:, mailto:): keep those as they are, fix only a link typed without one. Null when it is neither. */
export function coerceUrl(input: unknown): string | null {
  const t = String(input ?? '').trim();
  if (/^[a-z][a-z0-9+.-]*:(?!\d+(\/|$))/i.test(t)) { try { new URL(t); return t; } catch { return null; } }
  const n = normalizeUrl(t);
  return n.ok ? n.url : null;
}

/** One assert-based self-check; run with: npx tsx src/lib/url.ts */
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('url.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  const url = (s: string) => normalizeUrl(s).url;
  const same = (s: string, want: string) => assert(url(s) === want, `${s} -> ${url(s)}`);
  same('google.com', 'https://google.com');
  same('www.google.com', 'https://www.google.com');
  same('https://google.com', 'https://google.com');
  same('  HTTP://X.com/a?b=1  ', 'HTTP://X.com/a?b=1');
  same('//x.com', 'https://x.com');
  same('google.com/path?x=1', 'https://google.com/path?x=1');
  same('example.com:8080/a', 'https://example.com:8080/a');
  for (const s of ['javascript:alert(1)', 'data:text/html,hi', 'mailto:a@b.com', 'hello', 'a b.com', '', 'ftp://x.com', 'localhost', '127.0.0.1', 'x.c']) assert(!normalizeUrl(s).ok, s);
  assert(coerceUrl('tel:+94771234567') === 'tel:+94771234567' && coerceUrl('https://a.lk/x') === 'https://a.lk/x' && coerceUrl('a.lk') === 'https://a.lk', 'coerceUrl keeps schemes, fixes bare');
  assert(coerceUrl('hello') === null && coerceUrl('a b') === null && coerceUrl(5) === null, 'coerceUrl rejects junk');
  console.log('url.ts self-check ok');
}
