// Categories: every saved object has one, stored in qr_codes.category and never changed. Each category has its own data contract and its own designs
// (docs/technical/15-data-contract.md). This file is the one place the app asks "what is this object, which looks can it have, which editor opens it".
// Pure: shared by the browser, the server and the Worker. Self-check: npx tsx src/lib/categories.ts
import { PAGE_DESIGNS } from './pageDesigns.js';
import { FORM_DESIGNS } from './formDesigns.js';
export const CATEGORIES = ['restaurant', 'page', 'form', 'vcard', 'wifi', 'event', 'text', 'email', 'url'] as const;
export type Category = typeof CATEGORIES[number];

/** The qr_codes.qr_type each category is stored under. A restaurant is a `page` row, so plan caps and the Worker keep working. */
export const CATEGORY_QR_TYPE: Record<Category, string> = { restaurant: 'page', page: 'page', form: 'form', vcard: 'vcard', wifi: 'wifi', event: 'event', text: 'text', email: 'email', url: 'url' };

/** Design ids each category accepts. Restaurant: the Kit designs. The other categories get theirs in later phases (none yet).
 *  Ids only, so the browser never loads design bodies just to route or validate; the self-check in kitTemplates.ts keeps this list equal to the registry in kitDesigns/index.ts. */
export const CATEGORY_DESIGNS: Record<Category, string[]> = {
  restaurant: ['showcase-1', 'showcase-2', 'showcase-3', 'showcase-4', 'showcase-5', 'showcase-6', 'showcase-7', 'showcase-8', 'classic-1', 'classic-2', 'boba-1', 'boba-2', 'plate-1', 'plate-2', 'original'],
  page: Object.keys(PAGE_DESIGNS), form: Object.keys(FORM_DESIGNS), vcard: [], wifi: [], event: [], text: [], email: [], url: [],
};

const hasMenu = (cd: any) => Array.isArray(cd?.blocks) ? cd.blocks.some((b: any) => b?.kind === 'menu') : !!cd?.kit;

/** The category of a new object. A `page` with a menu (or an old Kit) is a restaurant, any other page is a page. */
export function categoryFor(qr_type: string, content_data?: any): Category {
  if (qr_type === 'page') return hasMenu(content_data) ? 'restaurant' : 'page';
  return (CATEGORIES as readonly string[]).includes(qr_type) ? (qr_type as Category) : 'url';
}

/** A stored row's category; rows saved before migration 018 are worked out from their content. */
export const categoryOf = (qr: any): Category => ((CATEGORIES as readonly string[]).includes(qr?.category) ? qr.category : categoryFor(qr?.qr_type || 'url', qr?.content_data));
export const isRestaurant = (qr: any) => categoryOf(qr) === 'restaurant';

/** An error message if `design` is not allowed for `category`, else null. null/undefined/'' means "no design chosen". */
export function designError(category: Category, design: unknown): string | null {
  if (design === undefined || design === null || design === '') return null;
  if (typeof design !== 'string') return 'design must be a string';
  return CATEGORY_DESIGNS[category].includes(design) ? null : `design "${design.slice(0, 40)}" is not available for ${category}`;
}

/** The editor that opens an object. Restaurants use the Kit wizard, pages the page builder, forms the form builder, the rest the Create QR editor. */
export function editorPath(qr: any): string {
  const slug = qr.slug ?? qr.id, c = categoryOf(qr);
  if (c === 'form') return `/forms/${slug}/edit`;
  if (qr.qr_type === 'page' || c === 'restaurant' || c === 'page') return qr.content_data?.blocks ? (c === 'restaurant' ? `/kit?page=${slug}` : `/pages/${slug}/edit`) : `/kit?edit=${qr.id ?? slug}`;
  return `/edit/${slug}`;
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('categories.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  assert(categoryFor('page', { blocks: [{ kind: 'menu' }] }) === 'restaurant' && categoryFor('page', { kit: {} }) === 'restaurant', 'menu or old kit is a restaurant');
  assert(categoryFor('page', { blocks: [{ kind: 'text' }] }) === 'page' && categoryFor('page', null) === 'page', 'other pages are pages');
  assert(categoryFor('form') === 'form' && categoryFor('wifi') === 'wifi' && categoryFor('nope') === 'url' && categoryFor('url') === 'url', 'other types keep their name');
  for (const c of CATEGORIES) assert(typeof CATEGORY_QR_TYPE[c] === 'string' && Array.isArray(CATEGORY_DESIGNS[c]), `registry row for ${c}`);
  assert(categoryOf({ category: 'page', qr_type: 'page', content_data: { blocks: [{ kind: 'menu' }] } }) === 'page', 'a stored category wins over a guess');
  assert(categoryOf({ qr_type: 'page', content_data: { blocks: [{ kind: 'menu' }] } }) === 'restaurant', 'an old row is worked out from content');
  assert(designError('restaurant', 'showcase-1') === null && designError('restaurant', null) === null && designError('restaurant', '') === null, 'known and empty designs are fine');
  assert(designError('restaurant', 'nope') !== null && designError('page', 'showcase-1') !== null && designError('restaurant', 5) !== null, 'unknown or foreign designs are refused');
  assert(editorPath({ slug: 'a', id: 'a', qr_type: 'page', category: 'restaurant', content_data: { blocks: [] } }) === '/kit?page=a', 'restaurant editor');
  assert(editorPath({ slug: 'a', id: 'a', qr_type: 'page', content_data: { blocks: [{ kind: 'text' }] } }) === '/pages/a/edit', 'page editor');
  assert(editorPath({ slug: 'a', id: 'a', qr_type: 'page', content_data: { kit: {} } }) === '/kit?edit=a', 'old kit editor');
  assert(editorPath({ slug: 'a', qr_type: 'form' }) === '/forms/a/edit' && editorPath({ slug: 'a', qr_type: 'url' }) === '/edit/a', 'form and other editors');
  console.log('categories self-check ok');
}
