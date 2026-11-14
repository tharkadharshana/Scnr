// Restaurant Kit templates: one card per design set. Each screen is a design (src/lib/kitDesigns) shown as its exact preview image;
// picking a screen gives the page that design's own HTML and CSS, filled with the design's sample menu.
import { normalizeMenu } from './menu.js';
import { DESIGNS } from './kitDesigns/index.js';
import { templateContentError } from './pageTemplates.js';
import { CATEGORY_DESIGNS } from './categories.js';
import { DESIGN_INFO } from './kitDesigns/manifest.js';

export interface KitScreen { img: string; label: string; design: string }
export interface KitTemplate { id: string; name: string; screens: KitScreen[] }

const S = (design: string, label: string): KitScreen => ({ img: `/kit/templates/${design}.jpg`, label, design });

export const KIT_TEMPLATES: KitTemplate[] = [
  { id: 'boba-tea', name: 'Bubble Tea', screens: [S('boba-1', 'Home menu'), S('boba-2', 'Drink detail')] },
  { id: 'healthy-plate', name: 'Healthy Plate', screens: [S('plate-1', 'Popular dishes'), S('plate-2', 'Dish details')] },
  { id: 'classic-1', name: 'Café Lagoon List', screens: [S('classic-1', 'List menu')] },
  { id: 'classic-2', name: 'Café Lagoon Grid', screens: [S('classic-2', 'Grid menu')] },
  ...([['Home List', 'Home list'], ['Dark Grid', 'Dark grid'], ['Refresh', 'Refresh showcase'], ['Side Rail', 'Side rail'], ['Product Detail', 'Product detail'], ['Food & Desserts', 'Food and desserts'], ['Table Order', 'Table order'], ['Snacks & Checkout', 'Snacks and checkout']] as const)
    .map(([name, label], i): KitTemplate => ({ id: `showcase-${i + 1}`, name: `Café Lagoon ${name}`, screens: [S(`showcase-${i + 1}`, label)] })),
];

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('kitTemplates.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  assert(JSON.stringify([...CATEGORY_DESIGNS.restaurant].sort()) === JSON.stringify([...Object.keys(DESIGNS), 'original'].sort()), 'categories.ts lists exactly the registered restaurant designs plus original');
  assert(JSON.stringify(Object.keys(DESIGN_INFO).sort()) === JSON.stringify([...CATEGORY_DESIGNS.restaurant].sort()), 'the manifest describes every restaurant design');
  for (const [id, dz] of Object.entries(DESIGNS)) { // the manifest must match what each design really does (designs are never edited to fit it)
    const h = dz.html, uses = [/\{\{name\}\}/.test(h) && 'name', /\{\{tagline\}\}/.test(h) && 'tagline', /item\.description/.test(h) && 'description', /item\.price/.test(h) && 'price', /item\.image/.test(h) && 'image'].filter(Boolean);
    assert(JSON.stringify(DESIGN_INFO[id].uses) === JSON.stringify(uses), `manifest uses for ${id}: ${uses}`);
    assert(DESIGN_INFO[id].orders === h.includes('data-scnr="add"'), `manifest orders flag for ${id}`);
  }
  for (const t of KIT_TEMPLATES) for (const s of t.screens) {
    const dz = DESIGNS[s.design];
    assert(dz && dz.id === s.design, `${s.design} is registered`);
    assert(JSON.stringify(normalizeMenu(dz.sample).sections) === JSON.stringify(dz.sample.sections), `${s.design} sample survives normalizeMenu`);
    for (const sl of dz.slots || []) {
      assert(['image', 'color', 'text'].includes(sl.type) && sl.key && sl.label && sl.default, `${s.design} slot ${sl.key} is well formed`);
      if (sl.type === 'color') assert(/^#[0-9a-f]{6}$/i.test(sl.default) && dz.css.includes(`var(--slot-${sl.key},`), `${s.design} accent ${sl.default} is a literal hex in its css`);
      if (sl.type === 'image' || sl.type === 'text') assert(dz.html.includes(`{{slot.${sl.key}}}`), `${s.design} uses {{slot.${sl.key}}}`);
    }
    assert(!templateContentError({ design: s.design, theme: { accent: '#E04A1F' }, blocks: [{ kind: 'header', name: 'Name', tagline: dz.sample.tagline || '' }, { kind: 'menu', sections: dz.sample.sections }] }), `${s.design} fits the content cap`);
  }
  console.log('kitTemplates self-check ok');
}
