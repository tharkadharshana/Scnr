// Kit designs: a pixel-exact page look built from a design's own HTML/CSS, filled with the owner's menu.
// A design's `html` is a trusted fragment (ours) with tokens; every value that goes in is escaped.
//   {{name}} {{tagline}} {{asset}}          page header text; base URL of the design photos
//   {{#sections}}…{{/#sections}}            per menu section: {{section.name}} {{section.id}} {{index}}; inside it {{#items}}…{{/#items}}
//   {{#items}}…{{/#items}}                  per item: {{item.name}} {{item.description}} {{item.price}} {{item.image}} {{item.ref}} ("section.item": put it in data-ref="…" on a data-scnr="add" button so the cart knows the item)
//   {{#allitems}}…{{/#allitems}}            every item of every section, flat
//   {{?key}}…{{/?key}} / {{!key}}…{{/!key}} shown when the value is non-empty / empty (keys: item.image, item.description, first, last, …)
// Same-named blocks must not nest. Self-check: npx tsx src/lib/designs.ts
/** Where design photos are served from (absolute so the Kit preview iframe and the Worker both reach them). {{asset}} in a design's HTML is this base. */
export const ASSET = 'https://scnr.tharkak.com/kit/templates/img/';
export interface DesignSample { name?: string; tagline?: string; sections: { name: string; items: { name: string; description?: string; price?: string; image?: string }[] }[] }
/** An owner-editable part of a design. `default` is exactly what the design's picture shows. Use the same keys across designs (`hero`, `accent`, `headline`) so a value survives a template switch. */
export interface Slot { key: string; type: 'image' | 'color' | 'text'; label: string; default: string; max?: number }
export interface Design { id: string; name: string; fonts?: string; css: string; html: string; sample: DesignSample; slots?: Slot[] }

/** Run once per design: a colour slot's default hex in the CSS becomes `var(--slot-<key>, hex)`, so the owner's colour can replace it. Escaped selectors (`\#hex`) are left alone. */
export function finishDesign(d: Design): Design {
  let css = d.css;
  for (const s of d.slots || []) if (s.type === 'color') css = css.replace(new RegExp(`(?<!\\\\)${s.default}(?![0-9a-f])`, 'gi'), `var(--slot-${s.key},${s.default.toLowerCase()})`);
  return { ...d, css };
}

/** The owner's slot values, checked (https images, #rrggbb colours, tags stripped from text), else the design's default. Returns the `{{slot.key}}` tokens and the CSS that sets the colour variables. */
export function slotValues(d: Design, raw: unknown): { ctx: Ctx; css: string } {
  const r: Record<string, unknown> = raw && typeof raw === 'object' ? (raw as any) : {};
  const ctx: Ctx = {}; let css = '';
  for (const s of d.slots || []) {
    const v = typeof r[s.key] === 'string' ? (r[s.key] as string).trim() : '';
    let out = s.default;
    if (s.type === 'image' && /^https:\/\/\S{1,480}$/i.test(v)) out = v;
    else if (s.type === 'color' && /^#[0-9a-f]{6}$/i.test(v)) { out = v; if (v.toLowerCase() !== s.default.toLowerCase()) css += `:root{--slot-${s.key}:${v}}`; }
    else if (s.type === 'text') { const t = v.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, s.max || 80); if (t) out = t; }
    ctx[`slot.${s.key}`] = out;
  }
  return { ctx, css };
}

type Ctx = Record<string, any>;

export function fill(tpl: string, ctx: Ctx, esc: (s: unknown) => string): string {
  return tpl
    .replace(/\{\{#([\w.]+)\}\}([\s\S]*?)\{\{\/#\1\}\}/g, (_, k, body) => (Array.isArray(ctx[k]) ? ctx[k] : []).map((row: Ctx) => fill(body, { ...ctx, ...row }, esc)).join(''))
    .replace(/\{\{\?([\w.]+)\}\}([\s\S]*?)\{\{\/\?\1\}\}/g, (_, k, body) => (ctx[k] ? fill(body, ctx, esc) : ''))
    .replace(/\{\{!([\w.]+)\}\}([\s\S]*?)\{\{\/!\1\}\}/g, (_, k, body) => (ctx[k] ? '' : fill(body, ctx, esc)))
    .replace(/\{\{([\w.]+)\}\}/g, (_, k) => esc(ctx[k]));
}

/** The token context for a page: header text plus the (already normalized) menu sections. */
/** A bare amount gets the page's currency in front ('USD' shows as $); a price that already has text or a symbol is kept as typed. */
export const money = (price: unknown, currency?: unknown) => {
  const t = String(price ?? '').trim(), c = /^[A-Z]{3}$/.test(String(currency)) ? String(currency) : '';
  return c && /^[\d.,]+$/.test(t) ? (c === 'USD' ? '$' : `${c} `) + t : t;
};

export function designCtx(name: string, tagline: string, sections: DesignSample['sections'], o: { currency?: unknown; prices?: boolean } = {}): Ctx {
  const rows = sections.map((s, i) => ({ 'section.name': s.name, 'section.id': `s${i}`, index: i + 1, first: i === 0, last: i === sections.length - 1,
    items: s.items.map((it, j) => ({ 'item.name': it.name, 'item.description': it.description || '', 'item.price': o.prices === false ? '' : money(it.price, o.currency), 'item.image': it.image || '', 'item.ref': `${i}.${j}`, index: j + 1, first: j === 0, last: j === s.items.length - 1 })) }));
  return { name, tagline, asset: ASSET, sections: rows, allitems: rows.flatMap(r => r.items) };
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('designs.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  const e = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const c = designCtx('A<b>', '', [{ name: 'S1', items: [{ name: 'x', price: '1', image: 'https://i/1.jpg' }, { name: 'y' }] }, { name: 'S2', items: [{ name: 'z' }] }]);
  const out = fill('{{name}}|{{#sections}}[{{section.name}}{{?first}}*{{/?first}}:{{#items}}{{item.name}}{{?item.image}}+{{/?item.image}}{{!item.image}}-{{/!item.image}},{{/#items}}]{{/#sections}}|{{#allitems}}{{item.name}}{{/#allitems}}|{{tagline}}', c, e);
  const sd = finishDesign({ id: 'x', name: 'x', css: '.a{color:#F86A6B}.b\\[\\#F86A6B\\]{c:1}', html: '', sample: { sections: [] },
    slots: [{ key: 'accent', type: 'color', label: 'A', default: '#F86A6B' }, { key: 'hero', type: 'image', label: 'H', default: 'https://d/h.jpg' }, { key: 'headline', type: 'text', label: 'T', default: 'Hi', max: 5 }] });
  assert(sd.css === '.a{color:var(--slot-accent,#f86a6b)}.b\\[\\#F86A6B\\]{c:1}', 'finishDesign leaves escaped selectors alone: ' + sd.css);
  assert(finishDesign({ ...sd, css: '.s{box-shadow:0 0 #F86A6B40}' }).css === '.s{box-shadow:0 0 #F86A6B40}', 'finishDesign skips 8-digit hex (alpha) values');
  const sv = slotValues(sd, { accent: '#112233', hero: 'http://evil', headline: '<b>Hello world</b>' });
  assert(sv.ctx['slot.accent'] === '#112233' && sv.css === ':root{--slot-accent:#112233}' && sv.ctx['slot.hero'] === 'https://d/h.jpg' && sv.ctx['slot.headline'] === 'Hello', 'slotValues: valid kept, bad falls back');
  assert(slotValues(sd, { accent: 'red;}' }).css === '' && slotValues(sd, null).ctx['slot.headline'] === 'Hi', 'slotValues: invalid colour and no input use defaults');
  assert(money('4.50', 'USD') === '$4.50' && money('450', 'LKR') === 'LKR 450' && money('LKR 5', 'USD') === 'LKR 5' && money('9', 'x<') === '9' && money('', 'LKR') === '', 'money');
  assert(designCtx('x', '', [{ name: 'S', items: [{ name: 'a' }, { name: 'b' }] }]).allitems[1]['item.ref'] === '0.1', 'item.ref is section.item');
  assert(out === 'A&lt;b&gt;|[S1*:x+,y-,][S2:z-,]|xyz|', 'fill: ' + out);
  const e2 = (s: unknown) => e(s).replace(/\{/g, '&#123;');
  assert(fill('{{name}}|{{tagline}}', designCtx('{{tagline}}', 'T', []), e2) === '&#123;&#123;tagline}}|T', 'owner text is not re-read as a token');
  console.log('designs self-check ok');
}
