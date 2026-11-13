// Requests that are not a person scanning: link-preview fetchers, browser prefetch, mail-link scanners, cloud servers.
// Shared by the Worker (the edge decides what counts) and the server (webhooks, local dev).
const BOT_UA = /bot|crawler|spider|preview|facebookexternalhit|googlebot|twitterbot|slackbot|whatsapp|telegram/i;
// Cloud networks that mail-link scanners and crawlers run from: AWS, Azure, DigitalOcean, OVH, Hetzner, Linode.
// ponytail: short list on purpose (a real person on a cloud VPN is only not counted, still redirected); add an ASN when a scanner shows in the logs.
const SCANNER_ASN = new Set([16509, 14618, 8075, 14061, 16276, 24940, 63949]);
// Browsers set this to the kind of request; a QR scan opens a page ("document"), never an image or script.
const NOT_A_PAGE = /^(image|script|style|iframe|embed|object|video|audio|font|track|worker)$/;

export const isBot = (ua: string) => BOT_UA.test(ua);

/** True when the request must still be redirected but must not count as a scan, a unique visitor or toward any limit. */
export function isNotAScan(method: string, ua: string, asn: number | null | undefined, header: (name: string) => string | null): boolean {
  if (method === 'HEAD' || isBot(ua)) return true;
  if (asn && SCANNER_ASN.has(Number(asn))) return true;
  if (/prefetch|preview/i.test(`${header('Purpose') || ''} ${header('Sec-Purpose') || ''} ${header('X-Purpose') || ''} ${header('X-Moz') || ''}`)) return true;
  return NOT_A_PAGE.test(header('Sec-Fetch-Dest') || '');
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('scanFilter.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  const h = (o: Record<string, string>) => (n: string) => o[n] ?? null;
  const phone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148';
  assert(!isNotAScan('GET', phone, 55430, h({ 'Sec-Fetch-Dest': 'document' })), 'a phone opening a page counts');
  assert(!isNotAScan('GET', phone, null, h({})), 'no hints counts (in-app browsers send none)');
  assert(isNotAScan('HEAD', phone, null, h({})), 'HEAD does not count');
  assert(isNotAScan('GET', 'WhatsApp/2.23', null, h({})) && isNotAScan('GET', 'Slackbot-LinkExpanding', null, h({})), 'link previews do not count');
  assert(isNotAScan('GET', phone, 8075, h({})), 'mail scanner network does not count');
  assert(isNotAScan('GET', phone, null, h({ Purpose: 'prefetch' })) && isNotAScan('GET', phone, null, h({ 'Sec-Purpose': 'prefetch;anonymous-client-ip' })), 'prefetch does not count');
  assert(isNotAScan('GET', phone, null, h({ 'Sec-Fetch-Dest': 'image' })) && !isNotAScan('GET', phone, null, h({ 'Sec-Fetch-Dest': 'empty' })), 'subresource does not count, fetch navigation does');
  console.log('scanFilter self-check ok');
}
