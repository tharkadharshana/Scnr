// Top bar search suggestions: pure in-memory ranking, no network. Sources: nav pages, actions, and the codes the Dashboard already loaded.
import { editorPath } from './categories';
export type Suggestion = { label: string; sub?: string; to: string; kw?: string };

// Everything the app itself says, known up front: matched instantly, no network. kw = words people type for it.
// Plan-gated pages (Bulk, API Docs, admin) are added by the layout from its own nav lists.
export const CATALOG: Suggestion[] = [
  { label: 'Dashboard', sub: 'Page', to: '/', kw: 'home my codes scans overview short links' },
  { label: 'Create QR code', sub: 'Action', to: '/create', kw: 'new qr generate make url link text email phone sms vcard wifi location' },
  { label: 'Analytics', sub: 'Page', to: '/analytics', kw: 'stats scans devices countries cities referrers traffic report' },
  { label: 'Pages', sub: 'Page', to: '/pages', kw: 'landing mobile page templates menu gallery wedding gift' },
  { label: 'New page', sub: 'Action', to: '/pages/new', kw: 'create landing page template blank' },
  { label: 'Your pages', sub: 'Page', to: '/pages/mine', kw: 'my pages list' },
  { label: 'Forms', sub: 'Page', to: '/forms', kw: 'feedback survey report complaint responses inbox' },
  { label: 'New form', sub: 'Action', to: '/forms/new', kw: 'create feedback survey report fields preset' },
  { label: 'Restaurant Kit', sub: 'Page', to: '/kit', kw: 'menu reviews google review wifi offers table cafe hotel' },
  { label: 'Profile & Settings', sub: 'Page', to: '/settings', kw: 'account profile company domain email password delete notifications' },
  { label: 'Billing', sub: 'Page', to: '/billing', kw: 'subscription invoice receipt payment plan cancel card payhere polar' },
  { label: 'Upgrade plan', sub: 'Action', to: '/billing', kw: 'pro team business price pricing premium' },
  { label: 'Pricing', sub: 'Page', to: '/pricing', kw: 'plans cost free trial lkr usd' },
  { label: 'Privacy Policy', sub: 'Legal', to: '/legal/privacy-policy', kw: 'data legal gdpr' },
  { label: 'Terms & Conditions', sub: 'Legal', to: '/legal/terms-and-conditions', kw: 'terms legal conditions' },
  { label: 'Refund Policy', sub: 'Legal', to: '/legal/refund-policy', kw: 'refund money back legal' },
];

let codes: Suggestion[] = [];
// The Dashboard calls this after its own fetch, so search never makes a request of its own.
export const setSearchCodes = (list: any[]) => {
  codes = list.map(q => ({
    label: String(q.title || q.slug),
    sub: q.kind === 'link' ? 'Short link' : q.qr_type === 'page' ? 'Page' : q.qr_type === 'form' ? 'Form' : 'QR code',
    to: editorPath(q),
  }));
};
export const getSearchCodes = () => codes;

// Prefix match first, then word start, then anywhere. Stops once the cap is full of the best tier.
export function rankSuggestions(items: Suggestion[], q: string, cap = 8): Suggestion[] {
  const n = q.trim().toLowerCase();
  if (!n) return items.slice(0, cap);
  const tiers: Suggestion[][] = [[], [], [], []];
  for (const it of items) {
    const l = it.label.toLowerCase();
    const i = l.indexOf(n);
    if (i < 0 && !(it.kw && it.kw.includes(n))) continue;
    const t = i < 0 ? 3 : i === 0 ? 0 : /\s|[-_/]/.test(l[i - 1]) ? 1 : 2;
    tiers[t].push(it);
    if (t === 0 && tiers[0].length >= cap) break;
  }
  return tiers.flat().slice(0, cap);
}

// [before, typed, after]: typed part renders bold, the rest grey.
export function splitMatch(label: string, q: string): [string, string, string] {
  const n = q.trim().toLowerCase();
  const i = n ? label.toLowerCase().indexOf(n) : -1;
  return i < 0 ? [label, '', ''] : [label.slice(0, i), label.slice(i, i + n.length), label.slice(i + n.length)];
}

declare const process: any;
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('suggest.ts')) {
  const assert = (c: boolean, m: string) => { if (!c) throw new Error('FAIL ' + m); };
  const items = ['Dashboard', 'Create QR', 'Daily menu', 'Wi-Fi card', 'Hot dash'].map(label => ({ label, to: '/' }));
  assert(rankSuggestions(items, 'da').map(x => x.label).join() === 'Dashboard,Daily menu,Hot dash', 'prefix first');
  assert(rankSuggestions(items, 'qr')[0].label === 'Create QR', 'word start');
  assert(rankSuggestions(items, 'DASH').map(x => x.label).join() === 'Dashboard,Hot dash', 'case and tiers');
  assert(rankSuggestions(items, 'fi')[0].label === 'Wi-Fi card', 'after hyphen');
  assert(rankSuggestions(items, 'zzz').length === 0, 'no match');
  assert(rankSuggestions(CATALOG, 'invoice')[0].label === 'Billing', 'keyword match');
  assert(rankSuggestions(CATALOG, 'wifi')[0].label === 'Create QR code' || rankSuggestions(CATALOG, 'wifi').some(x => x.label === 'Restaurant Kit'), 'keyword wifi');
  assert(rankSuggestions(items, '', 2).length === 2, 'empty query capped');
  assert(splitMatch('Dashboard', 'da').join('|') === '|Da|shboard', 'split');
  assert(splitMatch('Dashboard', 'x').join('|') === 'Dashboard||', 'split none');
  const big = Array.from({ length: 50000 }, (_, i) => ({ label: `code ${i} menu`, to: '/' }));
  const t0 = performance.now();
  for (let k = 0; k < 100; k++) rankSuggestions(big, 'menu');
  const per = (performance.now() - t0) / 100;
  assert(per < 16, `50k rank ${per.toFixed(2)}ms`);
  console.log(`ok suggest (50k rank ${per.toFixed(2)} ms)`);
}
