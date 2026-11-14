// Page designs: the look of a link-in-bio page (category 'page'). A design is a fixed theme (colours, button shape, font, header style); the owner only sets the accent colour on top.
// Small and standalone on purpose (no design bodies), so the browser can list and validate designs cheaply. Self-check: npx tsx src/lib/pageDesigns.ts
export interface PageTheme { accent: string; bg?: string; text?: string; button?: string; font?: string; bg2?: string; card?: string; line?: string; header?: string }
export interface PageDesign { name: string; theme: PageTheme }
const p = (name: string, theme: PageTheme): PageDesign => ({ name, theme });
const BASE: PageTheme = { accent: '#2B4A3A', bg: '#FFF8F2', text: '#24180F', button: 'rounded', font: 'system' };

/** `default` is the plain look every page had before designs existed. The others are the looks of the built-in page templates (src/lib/pageTemplates.ts keeps them equal, by a self-check). */
export const PAGE_DESIGNS: Record<string, PageDesign> = {
  default: p('Classic', BASE),
  'bio-creator': p('Creator Link-in-Bio', { accent: '#7C3AED', bg: '#F3E8FF', text: '#1E1B4B', button: 'pill', font: 'system', bg2: '#E0E7FF', header: 'plain', line: '#E5DAFB' }),
  'bio-business': p('Business Link-in-Bio', { accent: '#6366F1', bg: '#0E1020', text: '#F4F4FA', button: 'rounded', font: 'system', bg2: '#161A33', card: '#1C1D33', line: '#34365A', header: 'plain' }),
  'bio-foodie': p('Foodie Link-in-Bio', { accent: '#16A34A', bg: '#F0FDF4', text: '#14532D', button: 'pill', font: 'system', bg2: '#FEF9C3', header: 'plain', line: '#D9F2C7' }),
  'bio-portfolio': p('Personal Portfolio', { accent: '#8B5CF6', bg: '#0F1022', text: '#F4F4FA', button: 'rounded', font: 'system', bg2: '#241447', card: '#1C1D33', line: '#34365A', header: 'plain' }),
  'shop-products': p('Product Showcase', { accent: '#111827', bg: '#FFFFFF', text: '#111827', button: 'rounded', font: 'system', bg2: '#F3F4F6', line: '#E5E7EB' }),
  'shop-services': p('Services Menu', { accent: '#6366F1', bg: '#1B1440', text: '#F4F4FA', button: 'rounded', font: 'system', bg2: '#2B1F78', card: '#2A2570', line: '#443C9C', header: 'plain' }),
  'card-personal': p('Digital Business Card', { accent: '#38BDF8', bg: '#111318', text: '#F4F4FA', button: 'rounded', font: 'system', bg2: '#1B1F29', card: '#242833', line: '#343947', header: 'plain' }),
  'agency-listing': p('Agency Listing', { accent: '#2563EB', bg: '#EFF6FF', text: '#172554', button: 'rounded', font: 'system', bg2: '#E0ECFF', header: 'plain', line: '#CFE0FB' }),
  'menu-restaurant': p('Restaurant Menu', { accent: '#F59E0B', bg: '#16130F', text: '#F4F4FA', button: 'rounded', font: 'system', bg2: '#241B12', card: '#2A241C', line: '#3D3427', header: 'plain' }),
  'menu-cafe': p('Café Menu', { accent: '#D97706', bg: '#FFF7ED', text: '#431407', button: 'pill', font: 'serif', bg2: '#FFEBD6', header: 'plain', line: '#F5DCC0' }),
  'food-ordering': p('Food Ordering', { accent: '#DC2626', bg: '#DC2626', text: '#FFFFFF', button: 'rounded', font: 'system', bg2: '#B91C1C', header: 'plain', card: '#FDE8E8', line: '#F7BFBF' }),
  'food-reservation': p('Restaurant Reservation', { accent: '#EF4444', bg: '#15151A', text: '#F4F4FA', button: 'rounded', font: 'system', bg2: '#202028', card: '#23242C', line: '#3A3B46', header: 'plain' }),
  'promo-sale': p('Seasonal Sale', { accent: '#F97316', bg: '#F97316', text: '#FFFFFF', button: 'pill', font: 'system', bg2: '#EA580C', header: 'plain', line: '#FDBA74' }),
  'promo-event': p('Event Invitation', { accent: '#6366F1', bg: '#1E1B4B', text: '#F4F4FA', button: 'rounded', font: 'system', bg2: '#312E81', card: '#2B2870', line: '#4642A8', header: 'plain' }),
  'promo-card': p('Promotion Card', { accent: '#15803D', bg: '#15803D', text: '#FFFFFF', button: 'pill', font: 'system', bg2: '#166534', header: 'plain', card: '#ECFDF3', line: '#BBF7D0' }),
  'promo-feedback': p('Feedback Form', { accent: '#7C3AED', bg: '#FAF5FF', text: '#3B0764', button: 'rounded', font: 'system', bg2: '#EEF2FF', header: 'plain', line: '#E9D8FD' }),
  'promo-gift': p('Gift Message', { accent: '#DB2777', bg: '#FFF1F7', text: '#500724', button: 'pill', font: 'system', bg2: '#FCE7F3', header: 'plain', line: '#F9C6DD' }),
  'promo-wedding': p('Wedding Invitation', { accent: '#A16207', bg: '#FFFBEB', text: '#422006', button: 'rounded', font: 'system', bg2: '#FEF3C7', header: 'plain', line: '#F3E2B0' }),
  'realestate-listing': p('Property Listing', { accent: '#065F46', bg: '#ECFDF5', text: '#022C22', button: 'square', font: 'system' }),
  'realestate-agent': p('Agency Listings', { accent: '#1E3A8A', bg: '#EFF6FF', text: '#172554', button: 'rounded', font: 'system' }),
};

const HEX = /^#[0-9a-f]{6}$/i;
/** The theme a page renders with: the design's own, with the owner's accent colour on top when it is a valid #rrggbb. */
export const designTheme = (id: unknown, slots?: unknown): PageTheme | null => {
  if (typeof id !== 'string' || !Object.hasOwn(PAGE_DESIGNS, id)) return null;
  const a = (slots as any)?.accent;
  return { ...PAGE_DESIGNS[id].theme, ...(typeof a === 'string' && HEX.test(a) ? { accent: a } : {}) };
};

// Everything but the accent, with the renderer's own defaults filled in, so an unset value and its default compare equal.
const look = (t: any) => JSON.stringify([t?.bg || BASE.bg, t?.text || BASE.text, t?.button || 'rounded', t?.font || 'system', t?.bg2 || '', t?.card || '#FFFFFF', t?.line || '#EADFD3', t?.header || ''].map(x => String(x).toUpperCase()));
/** The design whose look equals an older free-form theme (a page made from a template), plus the accent to keep. Anything else becomes the plain `default` look with the old accent. */
export function designForTheme(theme: unknown): { design: string; accent?: string } {
  const t: any = theme && typeof theme === 'object' ? theme : {};
  const accent = typeof t.accent === 'string' && HEX.test(t.accent) ? t.accent : undefined;
  const hit = Object.entries(PAGE_DESIGNS).find(([id, d]) => id !== 'default' && look(d.theme) === look(t));
  const design = hit ? hit[0] : 'default';
  return { design, ...(accent && accent.toLowerCase() !== PAGE_DESIGNS[design].theme.accent.toLowerCase() ? { accent } : {}) };
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('pageDesigns.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  assert(Object.keys(PAGE_DESIGNS).length === 21 && PAGE_DESIGNS.default.theme.accent === '#2B4A3A', 'default plus twenty template looks');
  assert(designTheme('nope') === null && designTheme('__proto__') === null && designTheme(5) === null, 'unknown ids have no theme');
  assert(designTheme('bio-creator', { accent: '#112233' })!.accent === '#112233' && designTheme('bio-creator', { accent: 'red;}' })!.accent === '#7C3AED', 'accent slot: valid colour wins, bad one is ignored');
  for (const [id, d] of Object.entries(PAGE_DESIGNS)) { const r = designForTheme(d.theme); assert(r.design === id && !r.accent, `${id} maps back to itself`); }
  const own = designForTheme({ ...PAGE_DESIGNS['bio-creator'].theme, accent: '#00AA55' });
  assert(own.design === 'bio-creator' && own.accent === '#00AA55', 'a template theme with its own accent keeps the accent');
  const odd = designForTheme({ accent: '#123456', bg: '#010101', text: '#FEFEFE', button: 'pill', font: 'mono' });
  assert(odd.design === 'default' && odd.accent === '#123456', 'an unknown look becomes default with its accent');
  assert(designForTheme(undefined).design === 'default' && designForTheme({ accent: '#2B4A3A' }).design === 'default', 'no theme is default');
  console.log('pageDesigns self-check ok');
}
