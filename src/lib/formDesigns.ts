// Form designs: the look of a form page (category 'form'). A design is an accent colour plus a little CSS laid over the one form markup; the owner only sets the accent on top.
// `default` is the look every form had before designs existed (no extra CSS). Small and standalone, so the browser can list and validate designs cheaply. Self-check: npx tsx src/lib/formDesigns.ts
export interface FormDesign { name: string; accent: string; css: string }

export const FORM_DESIGNS: Record<string, FormDesign> = {
  default: { name: 'Classic', accent: '#2B4A3A', css: '' },
  // A tinted page with the fields on a raised white card.
  soft: { name: 'Soft card', accent: '#6D4AFF', css: `
  body{background:#F4F1FA} main{padding-top:0} .top{border-radius:0 0 22px 22px}
  .form{border:0;border-radius:18px;padding:20px;box-shadow:0 10px 28px rgba(60,40,120,.12)}
  .form input:not([type=checkbox]):not([type=radio]),.form select,.form textarea{border-color:#DDD6F0;border-radius:12px;background:#FBFAFE}
  .form button{border-radius:12px;padding:14px;font-size:15px}` },
  // A dark page: light text on deep colour, fields in a slightly lighter panel.
  dark: { name: 'Midnight', accent: '#38BDF8', css: `
  body{background:#10131A;color:#F2F4F8} .top{background:#161B26;color:#F2F4F8} .top h1{color:#fff} .langs a.on{color:#10131A}
  .box{background:#161B26;border-color:#2A3142;color:#F2F4F8} a.btn{background:#161B26;border-color:#2A3142;color:#F2F4F8}
  .form input:not([type=checkbox]):not([type=radio]),.form select,.form textarea{background:#0E1118;border-color:#343C50;color:#F2F4F8}
  .form button{color:#10131A;font-weight:700} .err{background:#3A1D22;color:#FFB4B4} footer{color:#8A93A8}` },
};

const HEX = /^#[0-9a-f]{6}$/i;
/** The accent and extra CSS a form renders with: the design's own, with the owner's accent on top when it is a valid #rrggbb. null when the id is not a form design. */
export const formStyle = (id: unknown, slots?: unknown): { accent: string; css: string } | null => {
  if (typeof id !== 'string' || !Object.hasOwn(FORM_DESIGNS, id)) return null;
  const a = (slots as any)?.accent;
  return { accent: typeof a === 'string' && HEX.test(a) ? a : FORM_DESIGNS[id].accent, css: FORM_DESIGNS[id].css };
};

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('formDesigns.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  assert(Object.keys(FORM_DESIGNS).join() === 'default,soft,dark' && FORM_DESIGNS.default.css === '' && FORM_DESIGNS.default.accent === '#2B4A3A', 'default has no extra css and the old accent');
  assert(formStyle('nope') === null && formStyle('__proto__') === null && formStyle(3) === null, 'unknown ids have no style');
  assert(formStyle('soft', { accent: '#112233' })!.accent === '#112233' && formStyle('soft', { accent: 'red;}' })!.accent === '#6D4AFF', 'accent slot: valid colour wins, bad one is ignored');
  for (const [id, d] of Object.entries(FORM_DESIGNS)) assert(HEX.test(d.accent) && !/[<>]/.test(d.css) && !/@import|url\(/i.test(d.css), `${id} is well formed (hex accent, no markup, no external css)`);
  console.log('formDesigns self-check ok');
}
