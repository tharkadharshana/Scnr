// Restaurant contract v1: what every restaurant (category 'restaurant') stores in content_data, whatever design shows it.
// A restaurant's look is the `design` column; the data below never changes shape when the look changes. See docs/technical/15-data-contract.md.
// Pure: shared by the server (trust boundary), the Kit wizard and the page editor. Self-check: npx tsx src/lib/contracts/restaurant.ts
export const RESTAURANT_V = 1;
/** Block kinds a restaurant may hold. `products` is a Pages-builder block and is not part of this contract. */
export const RESTAURANT_BLOCKS = ['header', 'text', 'offer', 'menu', 'button', 'wifi', 'socials', 'contact', 'image', 'video', 'divider'] as const;
const ONLY_ONE = ['header', 'menu', 'offer', 'wifi'];
/** The only owner-editable look settings (see the slot catalog). Same keys across designs, so a value survives a design switch. */
export const RESTAURANT_SLOTS = ['accent', 'hero', 'headline'] as const;
const KEYS = ['v', 'design', 'slots', 'orders', 'theme', 'blocks', 'i18n'];
export const RESTAURANT_BLOCK_MAX = 40;

const isObj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);

/** Checks a restaurant's content and returns it in contract form (version stamped, unknown keys and unknown slot keys dropped), or an error message. */
export function normalizeRestaurant(cd: unknown): { cd: Record<string, any> } | { err: string } {
  if (!isObj(cd)) return { err: 'A restaurant needs content_data' };
  const blocks = cd.blocks;
  if (!Array.isArray(blocks) || !blocks.length) return { err: 'A restaurant needs a header block' };
  if (blocks.length > RESTAURANT_BLOCK_MAX) return { err: `A restaurant can have up to ${RESTAURANT_BLOCK_MAX} blocks` };
  if (!isObj(blocks[0]) || blocks[0].kind !== 'header') return { err: 'A restaurant starts with its header block' };
  const seen: Record<string, number> = {};
  for (const b of blocks) {
    if (!isObj(b) || !(RESTAURANT_BLOCKS as readonly string[]).includes(b.kind)) return { err: `A restaurant cannot have a "${isObj(b) ? String(b.kind).slice(0, 20) : '?'}" block` };
    seen[b.kind] = (seen[b.kind] || 0) + 1;
    if (ONLY_ONE.includes(b.kind) && seen[b.kind] > 1) return { err: `A restaurant has one ${b.kind} block` };
  }
  const out: Record<string, any> = { v: RESTAURANT_V };
  for (const k of KEYS) if (k !== 'v' && cd[k] !== undefined) out[k] = cd[k];
  if (typeof out.design !== 'string') delete out.design;
  if ('slots' in out) {
    const s = isObj(out.slots) ? out.slots : {};
    out.slots = Object.fromEntries(RESTAURANT_SLOTS.filter(k => typeof s[k] === 'string').map(k => [k, s[k]]));
  }
  if ('orders' in out) out.orders = { on: isObj(out.orders) && out.orders.on === true };
  if ('theme' in out && !isObj(out.theme)) delete out.theme;
  if ('i18n' in out && !isObj(out.i18n)) delete out.i18n;
  return { cd: out };
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('restaurant.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  const ok = (cd: unknown) => { const r = normalizeRestaurant(cd); assert('cd' in r, 'should pass: ' + JSON.stringify(r)); return (r as any).cd; };
  const bad = (cd: unknown, why: string) => assert('err' in normalizeRestaurant(cd), 'should fail: ' + why);
  const header = { id: 'h1', kind: 'header', name: 'N', tagline: '' }, menu = { id: 'm1', kind: 'menu', sections: [] };
  const full = ok({ design: 'showcase-1', slots: { accent: '#112233', hero: 'https://x/h.jpg', headline: 'Hi', stale: 'x', bad: 5 }, orders: { on: true, extra: 1 }, theme: { accent: '#fff' },
    blocks: [header, { kind: 'text', text: 't' }, { kind: 'offer', text: 'o' }, menu, { kind: 'button', label: 'a', url: 'https://a' }, { kind: 'button', label: 'b', url: 'https://b' }, { kind: 'wifi', ssid: 's' }, { kind: 'socials', items: [] }], i18n: { si: { blocks: [] } }, kit: { old: 1 }, name: 'legacy' });
  assert(full.v === 1 && !('kit' in full) && !('name' in full), 'version stamped, unknown keys dropped');
  assert(JSON.stringify(full.slots) === JSON.stringify({ accent: '#112233', hero: 'https://x/h.jpg', headline: 'Hi' }), 'only the three slot keys survive');
  assert(JSON.stringify(full.orders) === '{"on":true}', 'orders is {on} only');
  assert(ok({ blocks: [header] }).v === 1 && !('orders' in ok({ blocks: [header] })), 'a header alone is a valid restaurant (empty menu allowed)');
  assert(ok({ orders: { on: 'yes' }, blocks: [header] }).orders.on === false, 'orders.on must be exactly true');
  bad(null, 'not an object'); bad({}, 'no blocks'); bad({ blocks: [] }, 'empty blocks'); bad({ blocks: [menu, header] }, 'header must be first');
  bad({ blocks: [header, menu, { ...menu }] }, 'two menus'); bad({ blocks: [header, header] }, 'two headers'); bad({ blocks: [header, { kind: 'wifi' }, { kind: 'wifi' }] }, 'two wifi');
  bad({ blocks: [header, { kind: 'products', items: [] }] }, 'products block'); bad({ blocks: [header, 'x'] }, 'non-object block'); bad({ blocks: [header, { kind: 'nope' }] }, 'unknown kind');
  bad({ blocks: [header, ...Array.from({ length: RESTAURANT_BLOCK_MAX }, () => ({ kind: 'divider' }))] }, 'too many blocks');
  assert(ok(full).v === 1 && JSON.stringify(ok(full)) === JSON.stringify(full), 'normalizing twice changes nothing');
  console.log('restaurant contract self-check ok');
}
