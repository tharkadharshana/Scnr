// Restaurant Kit templates: one card per design set. Each screen is a design (src/lib/kitDesigns) shown as its exact preview image;
// picking a screen gives the page that design's own HTML and CSS, filled with the design's sample menu.
import { normalizeMenu } from './menu.js';
import { DESIGNS } from './kitDesigns/index.js';
import { templateContentError } from './pageTemplates.js';

export interface KitScreen { img: string; label: string; design: string }
export interface KitTemplate { id: string; name: string; screens: KitScreen[] }

const S = (design: string, label: string): KitScreen => ({ img: `/kit/templates/${design}.jpg`, label, design });

export const KIT_TEMPLATES: KitTemplate[] = [
  { id: 'boba-tea', name: 'Bubble Tea', screens: [S('boba-1', 'Home menu'), S('boba-2', 'Drink detail')] },
  { id: 'cafe-lagoon-classic', name: 'Café Lagoon Classic', screens: [S('classic-1', 'List menu'), S('classic-2', 'Grid menu')] },
  { id: 'cafe-lagoon-showcase', name: 'Café Lagoon Showcase', screens: [S('showcase-1', 'Home list'), S('showcase-2', 'Dark grid'), S('showcase-3', 'Refresh showcase'), S('showcase-4', 'Side rail'),
    S('showcase-5', 'Product detail'), S('showcase-6', 'Food and desserts'), S('showcase-7', 'Table order'), S('showcase-8', 'Snacks and checkout')] },
  { id: 'healthy-plate', name: 'Healthy Plate', screens: [S('plate-1', 'Popular dishes'), S('plate-2', 'Dish details')] },
];

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('kitTemplates.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  for (const t of KIT_TEMPLATES) for (const s of t.screens) {
    const dz = DESIGNS[s.design];
    assert(dz && dz.id === s.design, `${s.design} is registered`);
    assert(JSON.stringify(normalizeMenu(dz.sample).sections) === JSON.stringify(dz.sample.sections), `${s.design} sample survives normalizeMenu`);
    assert(!templateContentError({ design: s.design, theme: { accent: '#E04A1F' }, blocks: [{ kind: 'header', name: 'Name', tagline: dz.sample.tagline || '' }, { kind: 'menu', sections: dz.sample.sections }] }), `${s.design} fits the content cap`);
  }
  console.log('kitTemplates self-check ok');
}
