/**
 * Scnr: API benchmark. Run with: QA_API_URL=http://localhost:3100 npx tsx tests/bench.ts
 *
 * Creates a disposable user (qa-bench-*@test.dynamicqr.local) on a Team plan with BENCH_CODES codes (default 120)
 * and 15 scan events each, times the main API calls (12 runs each; the first run is the cold one), then deletes the user.
 * Needs the same env as the QA suite (see docs/10-operations.md). The numbers include the network trip to Supabase,
 * so compare runs from the same machine, not absolute values.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const API = process.env.QA_API_URL || 'http://localhost:3000', URL_ = process.env.VITE_SUPABASE_URL!;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const anon = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY!);
const email = `qa-bench-${Date.now()}@test.dynamicqr.local`, password = 'Bench-' + Math.random().toString(36).slice(2) + 'A1!';
const N = Number(process.env.BENCH_CODES || 120), SCANS = 15;
const pct = (a: number[], p: number) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];

async function time(label: string, path: string, token: string, runs = 12) {
  const t: number[] = []; let bytes = 0, status = 0;
  for (let i = 0; i < runs; i++) {
    const s = performance.now();
    const r = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` } });
    bytes = (await r.arrayBuffer()).byteLength; status = r.status; t.push(performance.now() - s);
  }
  const rest = t.slice(1);
  console.log(`${label.padEnd(34)} ${status}  first=${t[0].toFixed(0).padStart(4)}ms  p50=${pct(rest, .5).toFixed(0).padStart(4)}ms  p95=${pct(rest, .95).toFixed(0).padStart(4)}ms  ${(bytes / 1024).toFixed(1)} KB`);
}

const { data: u, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error) throw error;
const uid = u.user!.id;
try {
  const { data: s } = await anon.auth.signInWithPassword({ email, password });
  const token = s.session!.access_token;
  await fetch(API + '/api/user/plan', { headers: { Authorization: `Bearer ${token}` } }); // creates the profile
  await admin.from('profiles').update({ plan: 'team', plan_expires_at: '2099-01-01T00:00:00Z' }).eq('id', uid);

  const slugs: string[] = [];
  const codes = Array.from({ length: N }, (_, i) => {
    const slug = 'bch' + Math.random().toString(36).slice(2, 9); slugs.push(slug);
    return { slug, user_uid: uid, title: `Bench code ${i}`, destination_url: 'https://example.com/' + i, qr_type: 'url', style: { dot_color: '#1A1916', bg_color: '#FFFFFF' } };
  });
  for (let i = 0; i < codes.length; i += 100) { const { error: e } = await admin.from('qr_codes').insert(codes.slice(i, i + 100)); if (e) throw e; }
  const days = (): any => Object.fromEntries(Array.from({ length: 90 }, (_, d) => [new Date(Date.now() - d * 864e5).toISOString().slice(0, 10), 10 + d % 7]));
  await admin.from('qr_stats').upsert(slugs.map(slug => ({ slug, total_scans: 900, unique_scans: 500, days: days(), countries: { LK: 600, IN: 200, US: 100 }, browsers: { Chrome: 700, Safari: 200 }, os: { Android: 600, iOS: 300 }, devices: { mobile: 800, desktop: 100 } })), { onConflict: 'slug' });
  const ev: any[] = [];
  slugs.forEach(slug => { for (let k = 0; k < SCANS; k++) ev.push({ slug, scanned_at: new Date(Date.now() - k * 36e5).toISOString(), country: 'LK', city: 'Colombo', device: 'mobile', os: 'Android', browser: 'Chrome', is_unique: k % 2 === 0 }); });
  for (let i = 0; i < ev.length; i += 500) await admin.from('scan_events').insert(ev.slice(i, i + 500));
  console.log(`seeded ${N} codes, ${ev.length} scan events; API ${API}`);

  const one = slugs[0], A = `/api/analytics/account/${uid}`;
  for (const [l, p] of [
    ['GET /api/health', '/api/health'], ['GET /api/user/plan', '/api/user/plan'],
    ['GET /api/qr (full stats)', '/api/qr'], ['GET /api/qr?lite=1', '/api/qr?lite=1'], ['GET /api/qr?lite=1&limit=24', '/api/qr?lite=1&limit=24'], ['GET /api/qr/folders', '/api/qr/folders'],
    ['account summary', A], ['account devices', A + '/devices'], ['account countries', A + '/countries'], ['account recent', A + '/recent'],
    ['account timeseries 30d', A + '/timeseries?days=30'], ['account timeseries 90d', A + '/timeseries?days=90'], ['account performance', A + '/performance'],
    ['code summary', `/api/analytics/${one}/summary`], ['code recent', `/api/analytics/${one}/recent`], ['code hours', `/api/analytics/${one}/hours`], ['GET /api/qr/:slug', `/api/qr/${one}`],
  ]) await time(l, p, token);
} finally {
  await admin.auth.admin.deleteUser(uid);
  console.log('bench user deleted');
}
