// Guest events: the fixed list of things a visitor can do on a page, and which categories may record which. One catalog for the server, the dashboard and the docs.
// Only the events marked "server" are written today (the server sees them happen, so they are exact). The rest are reserved names for a later in-page beacon. Self-check: npx tsx src/lib/events.ts
import type { Category } from './categories.js';

export const EVENTS = ['item_add', 'cart_open', 'order_placed', 'link_click', 'lang_switch', 'wifi_copy', 'vcf_save', 'form_start', 'form_submit', 'ics_save'] as const;
export type EventName = typeof EVENTS[number];

/** Events written by the server: an order placed, a form submitted, a tracked link clicked. */
export const SERVER_EVENTS: readonly EventName[] = ['order_placed', 'form_submit', 'link_click'];

/** The events each category allows. `scan` (the page view) is not listed: every category has it. */
export const CATEGORY_EVENTS: Record<Category, readonly EventName[]> = {
  restaurant: ['item_add', 'cart_open', 'order_placed', 'link_click', 'lang_switch', 'wifi_copy'],
  page: ['link_click', 'vcf_save', 'lang_switch'],
  form: ['form_start', 'form_submit'],
  vcard: ['vcf_save'],
  wifi: ['wifi_copy'],
  event: ['ics_save'],
  text: [], email: [], url: [],
};

export const eventAllowed = (category: string, name: string) => (CATEGORY_EVENTS as Record<string, readonly string[]>)[category]?.includes(name) ?? false;

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('events.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  assert(EVENTS.length === 10 && new Set(EVENTS).size === 10, 'ten unique events');
  for (const [c, list] of Object.entries(CATEGORY_EVENTS)) assert(list.every(e => (EVENTS as readonly string[]).includes(e)), `${c} only lists known events`);
  assert(SERVER_EVENTS.every(e => (EVENTS as readonly string[]).includes(e)), 'server events are known events');
  assert(eventAllowed('restaurant', 'order_placed') && eventAllowed('form', 'form_submit') && eventAllowed('page', 'link_click') && eventAllowed('restaurant', 'link_click'), 'the server events are allowed where they happen');
  assert(!eventAllowed('form', 'order_placed') && !eventAllowed('url', 'link_click') && !eventAllowed('nope', 'link_click') && !eventAllowed('page', 'nope'), 'other combinations are refused');
  console.log('events self-check ok');
}
