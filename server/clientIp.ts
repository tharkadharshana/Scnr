import { BlockList, isIP } from 'node:net';

// Cloudflare's published proxy ranges (https://www.cloudflare.com/ips/). They change rarely; a stale list only means a new range
// is treated like any other connection, which falls back to the connecting address (never less safe than before).
const CF_V4 = ['173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20',
  '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22'];
const CF_V6 = ['2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32'];
const cloudflare = new BlockList();
for (const c of CF_V4) { const [a, p] = c.split('/'); cloudflare.addSubnet(a, Number(p), 'ipv4'); }
for (const c of CF_V6) { const [a, p] = c.split('/'); cloudflare.addSubnet(a, Number(p), 'ipv6'); }

const clean = (ip: unknown) => String(ip || '').split(',')[0].trim().replace(/^::ffff:/i, '');
export const isCloudflare = (ip: string) => { const f = isIP(ip); return f === 4 || f === 6 ? cloudflare.check(ip, f === 4 ? 'ipv4' : 'ipv6') : false; };

/**
 * The visitor's address for rate limiting. Behind Vercel the connecting address is a proxy shared by everyone, so use the address
 * Vercel recorded for the peer (`x-vercel-forwarded-for`); when that peer is Cloudflare, the visitor is in CF-Connecting-IP.
 * Those headers are believed only when `trustProxy` is true (on Vercel, which sets them); anywhere else (local runs, CI, other hosts)
 * a client could send them itself to pick its own counter, so the socket address is used. The CF header is believed only from a Cloudflare peer.
 */
export function clientIp(headers: Record<string, unknown>, socketIp?: string, trustProxy = false): string {
  if (!trustProxy) return clean(socketIp);
  const peer = clean(headers['x-vercel-forwarded-for']) || clean(socketIp);
  const visitor = clean(headers['cf-connecting-ip']);
  return visitor && isIP(visitor) && isCloudflare(peer) ? visitor : peer;
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('clientIp.ts')) {
  const assert = (ok: boolean, msg: string) => { if (!ok) throw new Error('clientIp self-check failed: ' + msg); };
  assert(isCloudflare('173.245.48.1') && isCloudflare('104.16.0.1') && isCloudflare('2606:4700::1') && !isCloudflare('8.8.8.8') && !isCloudflare('not-an-ip'), 'ranges');
  const T = true;
  assert(clientIp({ 'x-vercel-forwarded-for': '173.245.48.1', 'cf-connecting-ip': '203.0.113.9' }, '10.0.0.1', T) === '203.0.113.9', 'cloudflare peer: visitor from header');
  assert(clientIp({ 'x-vercel-forwarded-for': '2606:4700::7', 'cf-connecting-ip': '203.0.113.9' }, '10.0.0.1', T) === '203.0.113.9', 'ipv6 cloudflare peer');
  assert(clientIp({ 'x-vercel-forwarded-for': '8.8.8.8', 'cf-connecting-ip': '203.0.113.9' }, '10.0.0.1', T) === '8.8.8.8', 'a normal peer: the header is ignored, the peer is the key');
  assert(clientIp({ 'cf-connecting-ip': '203.0.113.9' }, '::ffff:127.0.0.1', T) === '127.0.0.1', 'no peer header: socket address');
  assert(clientIp({ 'x-vercel-forwarded-for': '173.245.48.1', 'cf-connecting-ip': 'garbage' }, '10.0.0.1', T) === '173.245.48.1', 'bad header value ignored');
  // Off Vercel nothing in the headers is believed, so a client cannot pick its own counter.
  assert(clientIp({ 'x-vercel-forwarded-for': '173.245.48.1', 'cf-connecting-ip': '203.0.113.9', 'x-real-ip': '1.1.1.1' }, '::ffff:10.0.0.1') === '10.0.0.1', 'untrusted: socket address only');
  assert(clientIp({}) === '', 'empty');
  console.log('clientIp self-check ok');
}
