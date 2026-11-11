// Kit designs: a pixel-exact page look built from a design's own HTML/CSS, filled with the owner's menu.
// A design's `html` is a trusted fragment (ours) with tokens; every value that goes in is escaped.
//   {{name}} {{tagline}} {{asset}}          page header text; base URL of the design photos
//   {{#sections}}…{{/#sections}}            per menu section: {{section.name}} {{section.id}} {{index}}; inside it {{#items}}…{{/#items}}
//   {{#items}}…{{/#items}}                  per item: {{item.name}} {{item.description}} {{item.price}} {{item.image}}
//   {{#allitems}}…{{/#allitems}}            every item of every section, flat
//   {{?key}}…{{/?key}} / {{!key}}…{{/!key}} shown when the value is non-empty / empty (keys: item.image, item.description, first, last, …)
// Same-named blocks must not nest. Self-check: npx tsx src/lib/designs.ts
/** Where design photos are served from (absolute so the Kit preview iframe and the Worker both reach them). {{asset}} in a design's HTML is this base. */
export const ASSET = 'https://scnr.tharkak.com/kit/templates/img/';
export interface DesignSample { name?: string; tagline?: string; sections: { name: string; items: { name: string; description?: string; price?: string; image?: string }[] }[] }
export interface Design { id: string; name: string; fonts?: string; css: string; html: string; sample: DesignSample }

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
    items: s.items.map((it, j) => ({ 'item.name': it.name, 'item.description': it.description || '', 'item.price': o.prices === false ? '' : money(it.price, o.currency), 'item.image': it.image || '', index: j + 1, first: j === 0, last: j === s.items.length - 1 })) }));
  return { name, tagline, asset: ASSET, sections: rows, allitems: rows.flatMap(r => r.items) };
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('designs.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  const e = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const c = designCtx('A<b>', '', [{ name: 'S1', items: [{ name: 'x', price: '1', image: 'https://i/1.jpg' }, { name: 'y' }] }, { name: 'S2', items: [{ name: 'z' }] }]);
  const out = fill('{{name}}|{{#sections}}[{{section.name}}{{?first}}*{{/?first}}:{{#items}}{{item.name}}{{?item.image}}+{{/?item.image}}{{!item.image}}-{{/!item.image}},{{/#items}}]{{/#sections}}|{{#allitems}}{{item.name}}{{/#allitems}}|{{tagline}}', c, e);
  assert(money('4.50', 'USD') === '$4.50' && money('450', 'LKR') === 'LKR 450' && money('LKR 5', 'USD') === 'LKR 5' && money('9', 'x<') === '9' && money('', 'LKR') === '', 'money');
  assert(out === 'A&lt;b&gt;|[S1*:x+,y-,][S2:z-,]|xyz|', 'fill: ' + out);
  const e2 = (s: unknown) => e(s).replace(/\{/g, '&#123;');
  assert(fill('{{name}}|{{tagline}}', designCtx('{{tagline}}', 'T', []), e2) === '&#123;&#123;tagline}}|T', 'owner text is not re-read as a token');
  console.log('designs self-check ok');
}
