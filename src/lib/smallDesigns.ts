// Designs for the small categories that have a landing page: Wi-Fi (CSS skins over the one Wi-Fi box), and the vCard and Event landing pages.
// `default` is the look every code had before designs existed, so existing codes do not change: a Wi-Fi page as it was, and a vCard or event that downloads its file on scan.
// `card` (vCard) and `invite` (event) show a small page with a save button instead of downloading at once. Ids and CSS only, so the browser can list them cheaply. Self-check: npx tsx src/lib/smallDesigns.ts
export interface SmallDesign { name: string; accent: string; css: string }

export const WIFI_DESIGNS: Record<string, SmallDesign> = {
  default: { name: 'Classic', accent: '#2B4A3A', css: '' },
  soft: { name: 'Soft card', accent: '#6D4AFF', css: `
  body{background:#F4F1FA} .box{border:0;border-radius:18px;padding:22px;box-shadow:0 10px 28px rgba(60,40,120,.12);text-align:center}` },
  dark: { name: 'Midnight', accent: '#38BDF8', css: `
  body{background:#10131A;color:#F2F4F8} .box{background:#161B26;border-color:#2A3142;color:#F2F4F8;text-align:center} footer{color:#8A93A8}` },
};

/** Looks for the landing pages of a vCard and an event; the default of both is the file download they always were. */
export const CARD_DESIGNS: Record<string, SmallDesign> = {
  default: { name: 'Download', accent: '#2B4A3A', css: '' },
  card: { name: 'Business card', accent: '#2B4A3A', css: '' },
};
export const INVITE_DESIGNS: Record<string, SmallDesign> = {
  default: { name: 'Download', accent: '#2B4A3A', css: '' },
  invite: { name: 'Invitation', accent: '#6D4AFF', css: `
  body{background:#F4F1FA} .box{border:0;border-radius:18px;padding:22px;box-shadow:0 10px 28px rgba(60,40,120,.12);text-align:center}` },
};

/** The accent and CSS for a Wi-Fi, vCard or event page design, or null when the id is not one of that category's designs. */
export const smallStyle = (category: 'wifi' | 'vcard' | 'event', id: unknown): SmallDesign | null => {
  const set = category === 'wifi' ? WIFI_DESIGNS : category === 'vcard' ? CARD_DESIGNS : INVITE_DESIGNS;
  return typeof id === 'string' && Object.hasOwn(set, id) ? set[id] : null;
};

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('smallDesigns.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  assert(WIFI_DESIGNS.default.css === '' && Object.keys(WIFI_DESIGNS).join() === 'default,soft,dark', 'wifi default has no extra css');
  assert(smallStyle('wifi', 'soft')?.accent === '#6D4AFF' && smallStyle('wifi', 'nope') === null && smallStyle('wifi', '__proto__') === null && smallStyle('vcard', 'card') !== null && smallStyle('event', 'invite') !== null && smallStyle('event', 'card') === null, 'lookup by category');
  for (const set of [WIFI_DESIGNS, CARD_DESIGNS, INVITE_DESIGNS]) for (const [id, d] of Object.entries(set)) assert(/^#[0-9a-f]{6}$/i.test(d.accent) && !/[<>]/.test(d.css) && !/@import|url\(/i.test(d.css), `${id} is well formed`);
  console.log('smallDesigns self-check ok');
}
