// Golden harness: the exact output of renderGuestPage for every guest-facing look must never change by accident.
// A restaurant design that renders the same bytes (HTML + CSS) looks the same, pixel for pixel.
//   npx tsx tests/golden/guest.ts --check     fails on any byte difference (CI runs this)
//   npx tsx tests/golden/guest.ts --update    rewrites tests/golden/index.json (only with the owner's approval for a deliberate change)
// Only SHA-256 hashes are committed (the designs are ~150 KB of CSS each); a failing run writes the actual output to the OS temp folder.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderGuestPage } from '../../src/lib/guestPage.ts';
import { DESIGNS } from '../../src/lib/kitDesigns/index.ts';
import { PAGE_TEMPLATES } from '../../src/lib/pageTemplates.ts';
import { FORM_PRESETS } from '../../src/lib/forms.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX = join(HERE, 'index.json');
const URL_ = 'https://s.lk/abcdefg';
type Lang = 'en' | 'si' | 'ta';

// An owner menu that exercises every field, odd characters, a bad image, text prices and a missing price.
const OWNER_MENU = { id: 'm1', kind: 'menu', currency: 'LKR', prices: true, sections: [
  { name: 'Starters & Soups', items: [
    { name: 'Fish <Cutlets>', description: 'Crisp "golden" bites, 3 pcs', price: '450', image: 'https://img.lk/a.jpg' },
    { name: 'Tom Yum', description: 'Hot & sour', price: '900.50' },
    { name: 'Bad image item', price: 'Market price', image: 'http://insecure.lk/x.jpg' } ] },
  { name: 'Mains', items: [
    { name: 'Chicken Kottu', description: 'The classic', price: '1,250', image: 'https://img.lk/b.jpg' },
    { name: 'Rice {{tagline}}', description: 'Token look-alike text', price: '800' },
    { name: 'Free sample' } ] },
  { name: 'ස්වීට්', items: [{ name: 'ලොකු වටලප්පන්', description: 'රස', price: '600' }] },
] };
const EXTRA_BLOCKS = [
  { id: 't1', kind: 'text', text: 'Open 8am to 10pm. Family friendly.' },
  { id: 'o1', kind: 'offer', title: "Today's offer", text: 'Kottu 20% off <till 6pm>' },
  { id: 'b1', kind: 'button', label: 'Leave a Google review', url: 'https://g.page/r/abc/review' },
  { id: 'b2', kind: 'button', label: 'WhatsApp us', url: 'https://wa.me/94771234567' },
  { id: 'b3', kind: 'button', label: 'Call us', url: 'tel:+94112345678' },
  { id: 'b4', kind: 'button', label: 'Bad link', url: 'javascript:alert(1)' },
  { id: 'w1', kind: 'wifi', ssid: 'Cafe Guest', password: 'pa55word' },
];
const SI = { blocks: [{ name: 'කැෆේ ලගූන්', tagline: 'හොඳ කෑම' }] };
const TA = { blocks: [{ name: 'கஃபே லகூன்', tagline: 'நல்ல உணவு' }] };
const SLOTS = { accent: '#112233', hero: 'https://img.lk/hero.jpg', headline: 'Hello <b>World</b>' };

const cases: Record<string, () => any> = {};
const add = (id: string, cfg: any, lang: Lang = 'en', url = URL_) => { cases[id] = () => renderGuestPage(cfg, lang, url); };
const page = (cd: any, extra: any = {}) => ({ qr_type: 'page', slug: 'abcdefg', title: 'Café Lagoon', branding: true, content_data: cd, ...extra });

// 1. Every Kit design x several data shapes (the owner's hard-built UIs).
for (const [id, dz] of Object.entries(DESIGNS)) {
  const sm = dz.sample;
  const header = { id: 'h1', kind: 'header', name: sm.name || 'Café Lagoon', tagline: sm.tagline || 'Good food' };
  const sampleMenu = { id: 'm1', kind: 'menu', currency: 'USD', prices: true, sections: sm.sections };
  add(`kit/${id}/sample`, page({ design: id, blocks: [header, sampleMenu] }, { slug: undefined }));
  add(`kit/${id}/sample-orders`, page({ design: id, orders: { on: true }, blocks: [header, sampleMenu] }));
  add(`kit/${id}/owner-full`, page({ design: id, slots: SLOTS, orders: { on: true }, theme: { accent: '#2E5D45', bg: '#FFF8F2', text: '#24180F', button: 'rounded', font: 'system' },
    blocks: [header, EXTRA_BLOCKS[0], EXTRA_BLOCKS[1], OWNER_MENU, ...EXTRA_BLOCKS.slice(2)] }));
  add(`kit/${id}/owner-noprice`, page({ design: id, blocks: [header, { ...OWNER_MENU, prices: false, currency: 'USD' }] }));
  add(`kit/${id}/empty-menu`, page({ design: id, orders: { on: true }, blocks: [{ id: 'h1', kind: 'header', name: 'Empty', tagline: '' }, { id: 'm1', kind: 'menu', currency: 'LKR', prices: true, sections: [] }] }));
  add(`kit/${id}/si`, page({ design: id, slots: SLOTS, i18n: { si: SI }, blocks: [header, OWNER_MENU, EXTRA_BLOCKS[2]] }), 'si');
  add(`kit/${id}/ta-orders`, page({ design: id, orders: { on: true }, i18n: { ta: TA }, blocks: [header, OWNER_MENU] }), 'ta');
  add(`kit/${id}/branding-off`, page({ design: id, blocks: [header, OWNER_MENU] }, { branding: false }));
  add(`kit/${id}/password-orders`, page({ design: id, orders: { on: true }, blocks: [header, OWNER_MENU] }, { password_hash: 'x' }));
}

// 2. Restaurant pages with no design: the generic themed look (the wizard's "start blank").
const themes = [
  { accent: '#2E5D45', bg: '#FFF8F2', text: '#24180F', button: 'rounded', font: 'system' },
  { accent: '#7C3AED', bg: '#101020', bg2: '#302060', card: '#1B1D33', line: '#33355A', text: '#FFFFFF', button: 'pill', font: 'serif', header: 'plain' },
  { accent: '#B45309', bg: '#FFFBEB', text: '#451A03', button: 'square', font: 'mono' },
];
themes.forEach((th, i) => {
  const blocks = [{ id: 'h1', kind: 'header', name: 'Café <Lagoon>', tagline: 'Galle', emoji: '🍜' }, EXTRA_BLOCKS[0], EXTRA_BLOCKS[1], OWNER_MENU, ...EXTRA_BLOCKS.slice(2)];
  add(`blank/theme${i}/en`, page({ theme: th, blocks }));
  add(`blank/theme${i}/en-orders`, page({ theme: th, orders: { on: true }, blocks }));
  add(`blank/theme${i}/si`, page({ theme: th, i18n: { si: SI }, blocks }), 'si');
  add(`blank/theme${i}/ta-nolangs-noslug`, page({ theme: th, blocks }, { slug: undefined }), 'ta');
});
add('blank/vcf', page({ theme: themes[0], blocks: [{ id: 'h1', kind: 'header', name: 'N' }, { id: 'c1', kind: 'contact', phone: '+94 77 1', email: 'a@b.lk', address: 'Galle', website: 'https://x.lk' }] }), 'en', URL_ + '?vcf=1');

// 3. The original legacy Kit page (flat shape, no blocks).
const legacy = { qr_type: 'page', title: 'Café', branding: true, content_data: { name: 'Café <Lagoon>', subtitle: 'Galle', color: '#123456', offer: { title: 'Deal', text: 'Kottu' },
  links: [{ label: 'Menu', url: 'https://x.lk/m' }, { label: 'Review', url: 'https://g.page/r/x' }, { label: 'Bad', url: 'javascript:1' }], wifi: { ssid: 'W', password: 'p' },
  i18n: { si: { name: 'කැෆේ', subtitle: 'ගාල්ල', offer: { title: 'දීමනාව', text: 'කොත්තු' }, labels: ['මෙනුව', 'සමාලෝචනය'] }, ta: { name: 'கஃபே', labels: ['மெனு'] } } } };
for (const l of ['en', 'si', 'ta'] as Lang[]) add(`legacy-kit/${l}`, legacy, l);
add('legacy-kit/minimal', { qr_type: 'page', title: 'Only title', content_data: { name: 'Only' } });
// The same pages as blocks with design 'original' must render exactly the bytes the flat legacy shape does (checked below).
const origBlocks = [{ id: 'h1', kind: 'header', name: 'Café <Lagoon>', tagline: 'Galle' }, { id: 'o1', kind: 'offer', title: 'Deal', text: 'Kottu' },
  { id: 'b1', kind: 'button', label: 'Menu', url: 'https://x.lk/m' }, { id: 'b2', kind: 'button', label: 'Review', url: 'https://g.page/r/x' }, { id: 'b3', kind: 'button', label: 'Bad', url: 'javascript:1' }, { id: 'w1', kind: 'wifi', ssid: 'W', password: 'p' }];
const origI18n = { si: { blocks: [{ name: 'කැෆේ', tagline: 'ගාල්ල' }, { title: 'දීමනාව', text: 'කොත්තු' }, { label: 'මෙනුව' }, { label: 'සමාලෝචනය' }] }, ta: { blocks: [{ name: 'கஃபே' }, {}, { label: 'மெனு' }] } };
for (const l of ['en', 'si', 'ta'] as Lang[]) add(`kit-original/${l}`, { qr_type: 'page', title: 'Café', branding: true, content_data: { design: 'original', theme: { accent: '#123456' }, blocks: origBlocks, i18n: origI18n } }, l);
add('kit-original/minimal', { qr_type: 'page', title: 'Only title', content_data: { design: 'original', blocks: [{ id: 'h1', kind: 'header', name: 'Only' }] } });
add('kit-original/column-wins', { qr_type: 'page', title: 'Café', branding: true, design: 'original', content_data: { design: 'showcase-1', theme: { accent: '#123456' }, blocks: origBlocks } });

// 4. Other page templates (link-in-bio and business), form presets, and simple code types.
for (const t of PAGE_TEMPLATES) {
  add(`template/${t.id}/en`, page(t.content));
  add(`template/${t.id}/si-noslug`, page({ ...t.content, i18n: { si: SI } }, { slug: undefined }), 'si');
}
for (const [k, f] of Object.entries(FORM_PRESETS)) {
  const cfg = { qr_type: 'form', slug: 'abcdefg', title: 'F', branding: true, content_data: f };
  add(`form/${k}/en`, cfg);
  add(`form/${k}/si-error`, cfg, 'si');
  cases[`form/${k}/error-state`] = () => renderGuestPage(cfg, 'en', URL_, { error: 'Please fill this <in>', values: { f0: '3' } });
  cases[`form/${k}/done`] = () => renderGuestPage(cfg, 'en', URL_, { done: true });
}
add('wifi/en', { qr_type: 'wifi', branding: true, title: 'W', content_data: { ssid: 'Net <1>', password: 'pw"', encryption: 'WPA' } });
add('wifi/si-nobrand', { qr_type: 'wifi', branding: false, title: 'W', content_data: { ssid: 'Net', password: '' } }, 'si');
add('text/en', { qr_type: 'text', branding: true, title: 'Note', content_data: { text: 'Line 1\n<b>Line</b> 2' } });
add('vcard/en', { qr_type: 'vcard', content_data: { first_name: 'Ama', last_name: 'Perera', phone: '+94771234567', email: 'a@b.lk', company: 'Scnr', website: 'https://x.lk' } });
add('event/en', { qr_type: 'event', slug: 'abcdefg', content_data: { title: 'Launch; party, 2', start: '2026-11-01T18:30', end: '2026-11-01T21:00', location: 'Galle', description: 'Come', url: 'https://x.lk' } });
add('email/en', { qr_type: 'email', content_data: { email: 'a@b.lk', subject: 'Hi there', body: 'Hello & bye' } });
add('url/none', { qr_type: 'url', content_data: {} });

const sha = (o: any) => createHash('sha256').update(o == null ? 'null' : `${o.kind}\n${String(o.body ?? o.location ?? '').replace(/DTSTAMP:\S+/g, 'DTSTAMP:x')}\n${o.filename ?? ''}`).digest('hex'); // DTSTAMP is the render time
const dump = (id: string, o: any) => { const f = join(tmpdir(), 'scnr-golden', id.replace(/[^\w.-]+/g, '_') + '.html'); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, o == null ? 'null' : String(o.body ?? o.location ?? '')); return f; };

const mode = process.argv[2];
const current: Record<string, string> = {};
let flaky = 0;
for (const [id, run] of Object.entries(cases)) {
  const a = sha(run()), b = sha(run()); // rendering must be deterministic, or no snapshot can be trusted
  if (a !== b) { console.error('NONDETERMINISTIC', id); flaky++; }
  current[id] = a;
}
if (flaky) process.exit(1);
for (const l of ['en', 'si', 'ta', 'minimal']) if (current[`kit-original/${l}`] !== current[`legacy-kit/${l}`]) { console.error('The original design renders differently from the flat legacy page:', l); process.exit(1); }

if (mode === '--update') {
  writeFileSync(INDEX, JSON.stringify(current, null, 1) + '\n');
  console.log(`golden: wrote ${Object.keys(current).length} hashes to tests/golden/index.json`);
} else if (mode === '--check') {
  const want: Record<string, string> = JSON.parse(readFileSync(INDEX, 'utf8'));
  const bad: string[] = [];
  for (const id of new Set([...Object.keys(want), ...Object.keys(current)])) {
    if (want[id] !== current[id]) { bad.push(id); console.error(want[id] ? (current[id] ? 'CHANGED ' : 'MISSING ') : 'NEW     ', id, current[id] ? '-> ' + dump(id, cases[id]()) : ''); }
  }
  if (bad.length) { console.error(`golden: ${bad.length} of ${Object.keys(current).length} outputs differ. Fix the code, not the snapshot.`); process.exit(1); }
  console.log(`golden ok: ${Object.keys(current).length} guest outputs are byte-identical`);
} else { console.error('usage: npx tsx tests/golden/guest.ts --check | --update'); process.exit(2); }
