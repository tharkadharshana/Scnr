// Page contract v1: what every page (category 'page', a link-in-bio page) stores in content_data, whatever design shows it.
// The look is the `design` column (a key of PAGE_DESIGNS); the only owner setting on top is the accent colour (`slots.accent`). Self-check: npx tsx src/lib/contracts/page.ts
import { PAGE_DESIGNS, designForTheme } from '../pageDesigns.js';

export const PAGE_V = 1;
/** Block kinds a page may hold. `menu` belongs to the Restaurant Kit. */
export const PAGE_BLOCKS = ['header', 'socials', 'button', 'text', 'image', 'video', 'products', 'contact', 'offer', 'wifi', 'divider'] as const;
export const PAGE_BLOCK_MAX = 40;
const HEX = /^#[0-9a-f]{6}$/i;
const isObj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);

/** Checks a page's content and returns it in contract form, or an error message. The look is taken from `design`, else worked out from an older free-form `theme`, which is then dropped.
 *  Returns the design too, so the caller can store it in the design column. */
export function normalizePage(cd: unknown, design?: unknown): { cd: Record<string, any>; design: string } | { err: string } {
  if (!isObj(cd)) return { err: 'A page needs content_data' };
  const blocks = cd.blocks;
  if (!Array.isArray(blocks) || !blocks.length) return { err: 'A page needs at least one block' };
  if (blocks.length > PAGE_BLOCK_MAX) return { err: `A page can have up to ${PAGE_BLOCK_MAX} blocks` };
  for (const b of blocks) if (!isObj(b) || !(PAGE_BLOCKS as readonly string[]).includes(b.kind)) return { err: isObj(b) && b.kind === 'menu' ? 'A menu belongs to a Restaurant Kit, not a page' : `A page cannot have a "${isObj(b) ? String(b.kind).slice(0, 20) : '?'}" block` };
  const wanted = typeof design === 'string' && design ? design : typeof cd.design === 'string' ? cd.design : '';
  const fromTheme = designForTheme(cd.theme);
  const id = wanted && Object.hasOwn(PAGE_DESIGNS, wanted) ? wanted : fromTheme.design;
  const given = isObj(cd.slots) && typeof cd.slots.accent === 'string' && HEX.test(cd.slots.accent) ? cd.slots.accent : undefined;
  const accent = given ?? (id === fromTheme.design ? fromTheme.accent : cd.theme?.accent && HEX.test(cd.theme.accent) ? cd.theme.accent : undefined);
  const out: Record<string, any> = { v: PAGE_V, design: id, slots: accent && accent.toLowerCase() !== PAGE_DESIGNS[id].theme.accent.toLowerCase() ? { accent } : {}, blocks };
  if (isObj(cd.i18n)) out.i18n = cd.i18n;
  return { cd: out, design: id };
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('page.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  const hd = { kind: 'header', name: 'N' };
  const ok = (cd: unknown, d?: unknown) => { const r = normalizePage(cd, d); assert('cd' in r, 'should pass: ' + JSON.stringify(r)); return r as any; };
  const bad = (cd: unknown, why: string) => assert('err' in normalizePage(cd), 'should fail: ' + why);
  const a = ok({ blocks: [hd, { kind: 'button', label: 'x', url: 'https://x' }], theme: { ...PAGE_DESIGNS['bio-creator'].theme }, orders: { on: true }, kit: 1 });
  assert(a.design === 'bio-creator' && a.cd.v === 1 && !('theme' in a.cd) && !('orders' in a.cd) && !('kit' in a.cd) && JSON.stringify(a.cd.slots) === '{}', 'a template theme becomes its design, no theme stored');
  const b = ok({ blocks: [hd], theme: { accent: '#123456', bg: '#010101', text: '#FEFEFE', button: 'pill', font: 'mono' } });
  assert(b.design === 'default' && b.cd.slots.accent === '#123456', 'an unknown theme becomes default with its accent');
  const c = ok({ blocks: [hd], design: 'menu-cafe', slots: { accent: '#00AA55', hero: 'https://x/h.jpg' } });
  assert(c.design === 'menu-cafe' && JSON.stringify(c.cd.slots) === '{"accent":"#00AA55"}', 'only the accent slot is kept');
  assert(ok({ blocks: [hd], design: 'nope' }).design === 'default' && ok({ blocks: [hd] }, 'promo-gift').design === 'promo-gift', 'unknown design falls back; the design argument wins');
  assert(ok({ blocks: [hd], design: 'default', slots: { accent: '#2B4A3A' } }).cd.slots.accent === undefined, 'the design\'s own accent is not stored as an override');
  bad(null, 'not an object'); bad({ blocks: [] }, 'no blocks'); bad({ blocks: [hd, { kind: 'menu' }] }, 'menu block'); bad({ blocks: [hd, { kind: 'nope' }] }, 'unknown kind');
  bad({ blocks: [hd, ...Array.from({ length: PAGE_BLOCK_MAX }, () => ({ kind: 'divider' }))] }, 'too many blocks');
  assert(JSON.stringify(ok(a.cd, a.design).cd) === JSON.stringify(a.cd), 'normalizing twice changes nothing');
  console.log('page contract self-check ok');
}
