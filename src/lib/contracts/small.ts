// Contracts v1 for the small categories (vcard, wifi, event, text, email, url): what each stores in content_data.
// vcard, wifi, event, text and email: unknown keys are dropped, text is capped, single-line fields cannot hold a line break, `v` is stamped. A url code keeps every key it has (its link kinds differ), only WhatsApp is renamed.
// The cross-cutting keys every code may carry (routing `rules`, `gps`, `utm`, and the owner's private `note`, 200 characters) pass through; the routes that own `rules` and `utm` check them.
// A WhatsApp code is a url code with kind 'whatsapp', `phone` and `text` (older drafts used wa_phone and wa_text). Self-check: npx tsx src/lib/contracts/small.ts

export const SMALL_V = 1;
export const SMALL_CATEGORIES = ['vcard', 'wifi', 'event', 'text', 'email', 'url'] as const;
export type SmallCategory = typeof SMALL_CATEGORIES[number];

// key: max length. Fields are plain strings.
const FIELDS: Record<Exclude<SmallCategory, 'url'>, Record<string, number>> = {
  vcard: { first_name: 100, last_name: 100, phone: 40, email: 200, company: 150, website: 300 },
  wifi: { ssid: 64, password: 128, encryption: 10 },
  event: { title: 200, start: 30, end: 30, location: 300, description: 2000, url: 500 },
  text: { text: 4000 },
  email: { email: 200, subject: 300, body: 2000 },
};
const ENCRYPTION = ['WPA', 'WEP', 'nopass'];
const CROSS = ['rules', 'gps', 'utm', 'note'];
const MULTILINE = new Set(['text', 'body', 'description', 'note']); // every other text field is one line: a line break in a vCard or Wi-Fi field would add properties to the file a scanner downloads
const isObj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);

/** Checks a small category's content and returns it in contract form, or an error message. */
export function normalizeSmall(category: SmallCategory, cd: unknown): { cd: Record<string, any> } | { err: string } {
  if (cd === undefined || cd === null) cd = {};
  if (!isObj(cd)) return { err: 'content_data must be an object' };
  const out: Record<string, any> = { v: SMALL_V };
  if (category === 'url') {
    // Everything a url code carries today stays; only the WhatsApp number and message move to their contract names.
    for (const [k, val] of Object.entries(cd)) if (k !== 'wa_phone' && k !== 'wa_text' && k !== 'v') out[k] = val;
    if (cd.wa_phone !== undefined || cd.wa_text !== undefined) {
      if (cd.wa_phone !== undefined && out.phone === undefined) out.phone = cd.wa_phone;
      if (cd.wa_text !== undefined && out.text === undefined) out.text = cd.wa_text;
      out.kind = 'whatsapp';
    }
    for (const k of ['phone', 'text']) if (out[k] !== undefined && (typeof out[k] !== 'string' || out[k].length > (k === 'phone' ? 40 : 1000))) return { err: `${k} is too long or not text` };
    return { cd: out };
  }
  for (const [k, max] of Object.entries(FIELDS[category])) {
    const x = cd[k];
    if (k === 'encryption' && x === '') { out[k] = 'nopass'; continue; } // the editor's "None (open)"
    if (x === undefined || x === null || x === '') continue;
    if (typeof x !== 'string') return { err: `${k} must be text` };
    if (x.length > max) return { err: `${k} can be up to ${max} characters` };
    if (!MULTILINE.has(k) && /[\r\n]/.test(x)) return { err: `${k} must be on one line` };
    out[k] = x;
  }
  if (category === 'wifi' && out.encryption !== undefined && !ENCRYPTION.includes(out.encryption)) return { err: 'encryption must be WPA, WEP or nopass' };
  for (const k of CROSS) if (cd[k] !== undefined) out[k] = cd[k];
  if (out.note !== undefined && (typeof out.note !== 'string' || out.note.length > 200)) return { err: 'note can be up to 200 characters' };
  return { cd: out };
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('small.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  const ok = (c: SmallCategory, cd: unknown) => { const r = normalizeSmall(c, cd); assert('cd' in r, `should pass: ${c} ${JSON.stringify(r)}`); return (r as any).cd; };
  const bad = (c: SmallCategory, cd: unknown, why: string) => assert('err' in normalizeSmall(c, cd), `should fail: ${why}`);
  const v = ok('vcard', { first_name: 'A', phone: '1', junk: 1, kind: 'x' });
  assert(v.v === 1 && v.first_name === 'A' && !('junk' in v) && !('kind' in v), 'vcard: keys whitelisted, v stamped');
  assert(ok('wifi', { ssid: 'Cafe', password: 'p', encryption: 'WEP' }).encryption === 'WEP' && ok('wifi', { ssid: 'x' }).encryption === undefined, 'wifi fields');
  assert(ok('wifi', { ssid: 'x', encryption: '' }).encryption === 'nopass', 'open Wi-Fi is nopass');
  assert(ok('vcard', { first_name: 'A', note: 'mine' }).note === 'mine', 'the private note survives');
  bad('vcard', { first_name: 'A\nTEL:1' }, 'line break in a one-line field'); bad('wifi', { ssid: 'x', note: 'n'.repeat(201) }, 'note too long'); assert(ok('text', { text: 'a\nb' }).text === 'a\nb', 'text may have lines');
  bad('wifi', { ssid: 'x', encryption: 'WPA9' }, 'bad encryption'); bad('wifi', { ssid: 'x'.repeat(65) }, 'ssid too long'); bad('vcard', { first_name: 5 }, 'not text'); bad('text', 'hi', 'not an object');
  assert(ok('event', { title: 'T', start: '2026-11-01T18:30', rules: [1], gps: true, utm: { a: 1 } }).rules.length === 1, 'cross keys pass through');
  assert(ok('text', undefined).v === 1, 'empty content is allowed (the editors check required fields)');
  const w = ok('url', { wa_phone: '+94 77 123 4567', wa_text: 'Hi', utm: { utm_source: 'x' } });
  assert(w.kind === 'whatsapp' && w.phone === '+94 77 123 4567' && w.text === 'Hi' && !('wa_phone' in w) && w.utm.utm_source === 'x', 'whatsapp moves to kind, phone, text');
  const l = ok('url', { kind: 'instagram', handle: 'x', batch: 'b1' });
  assert(l.kind === 'instagram' && l.handle === 'x' && l.batch === 'b1', 'other url kinds keep their keys');
  bad('url', { phone: 5 }, 'phone not text');
  assert(JSON.stringify(ok('url', w)) === JSON.stringify(w) && JSON.stringify(ok('vcard', v)) === JSON.stringify(v), 'normalizing twice changes nothing');
  console.log('small contracts self-check ok');
}
