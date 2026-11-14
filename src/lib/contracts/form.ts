// Form contract v1: what every form (category 'form') stores in content_data, whatever design shows it.
// The look is the `design` column (a key of FORM_DESIGNS); the only owner setting on top is the accent colour (`slots.accent`). Self-check: npx tsx src/lib/contracts/form.ts
import { FORM_DESIGNS } from '../formDesigns.js';
import { formDefError } from '../forms.js';

export const FORM_V = 1;
const HEX = /^#[0-9a-f]{6}$/i;
const isObj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);
const KEYS = ['title', 'intro', 'submit_label', 'thank_you', 'notify_email', 'redirect_url', 'fields'];

/** Checks a form definition (the rules in forms.ts) and returns it in contract form: version stamped, unknown keys dropped, the look as `design` plus an accent override. Or an error message. */
export function normalizeForm(cd: unknown, design?: unknown): { cd: Record<string, any>; design: string } | { err: string } {
  const e = isObj(cd) ? formDefError(cd) : 'A form needs content_data';
  if (e || !isObj(cd)) return { err: e || 'A form needs content_data' };
  const wanted = typeof design === 'string' && design ? design : typeof cd.design === 'string' ? cd.design : '';
  const id = wanted && Object.hasOwn(FORM_DESIGNS, wanted) ? wanted : 'default';
  const accent = isObj(cd.slots) && typeof cd.slots.accent === 'string' && HEX.test(cd.slots.accent) ? cd.slots.accent : undefined;
  const out: Record<string, any> = { v: FORM_V, design: id, slots: accent && accent.toLowerCase() !== FORM_DESIGNS[id].accent.toLowerCase() ? { accent } : {} };
  for (const k of KEYS) if (cd[k] !== undefined) out[k] = cd[k];
  return { cd: out, design: id };
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('form.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  const f = { id: 'f0', type: 'text', label: 'Name' };
  const ok = (cd: unknown, d?: unknown) => { const r = normalizeForm(cd, d); assert('cd' in r, 'should pass: ' + JSON.stringify(r)); return r as any; };
  const a = ok({ title: 'T', fields: [f], junk: 1, theme: { accent: '#fff' }, slots: { accent: '#112233', logo: 'x' }, design: 'soft', submit_label: 'Go' });
  assert(a.design === 'soft' && a.cd.v === 1 && !('junk' in a.cd) && !('theme' in a.cd) && JSON.stringify(a.cd.slots) === '{"accent":"#112233"}' && a.cd.submit_label === 'Go', 'contract form: design, accent only, unknown keys dropped');
  assert(ok({ fields: [f] }).design === 'default' && ok({ fields: [f], design: 'nope' }).design === 'default' && ok({ fields: [f] }, 'dark').design === 'dark', 'default, unknown falls back, the design argument wins');
  assert(ok({ fields: [f], design: 'dark', slots: { accent: '#38BDF8' } }).cd.slots.accent === undefined, "the design's own accent is not stored as an override");
  assert('err' in normalizeForm(null) && 'err' in normalizeForm({ fields: [] }) && 'err' in normalizeForm({ fields: [f, f] }) && 'err' in normalizeForm({ fields: [f], redirect_url: 'http://x' }), 'bad forms are refused with the forms.ts rules');
  assert(JSON.stringify(ok(a.cd, a.design).cd) === JSON.stringify(a.cd), 'normalizing twice changes nothing');
  console.log('form contract self-check ok');
}
