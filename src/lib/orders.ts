// Orders (mini POS) rules shared by the API and the tests: what a guest may send, how the total is priced, who may move an order where.
// The server prices every line from the stored page; nothing a guest sends (price, name) is trusted. Self-check: npx tsx src/lib/orders.ts
import { normalizeMenu, type MenuSection } from './menu.js';

export const STATUSES = ['new', 'accepted', 'cooking', 'ready', 'delivered', 'cancelled', 'rejected'] as const;
export type OrderStatus = typeof STATUSES[number];
export const OPEN: OrderStatus[] = ['new', 'accepted', 'cooking', 'ready'];
export const FLOW: OrderStatus[] = ['new', 'accepted', 'cooking', 'ready', 'delivered'];
export const HONEYPOT = '_hp';
export const LIMITS = { lines: 40, qty: 20, name: 60, note: 200, table: 10, pickup: 20, total: 10_000_000 };

/** Owner moves: forward along the flow (skipping is fine), or out through cancelled/rejected from any open state. Closed orders stay closed. */
export const canMove = (from: string, to: string) =>
  OPEN.includes(from as OrderStatus) && (FLOW.indexOf(to as OrderStatus) > FLOW.indexOf(from as OrderStatus) && FLOW.includes(to as OrderStatus) || to === 'cancelled' || to === 'rejected');

/** "LKR 1,200.50" or "4.50" → 1200.5 / 4.5. No number in it (or "Market price") → 0: priced at the counter. */
export function parsePrice(p: unknown): number {
  const m = String(p ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  const n = m ? Number(m[0]) : 0;
  return Number.isFinite(n) && n > 0 && n < 1e7 ? Math.round(n * 100) / 100 : 0;
}

/** The menu the cart orders from: the page's first menu block, in the base language. A line points at it by section and item index. */
export function orderMenu(d: any): { sections: MenuSection[]; currency: string } {
  const b = (Array.isArray(d?.blocks) ? d.blocks : []).find((x: any) => x?.kind === 'menu');
  return { sections: normalizeMenu(b || {}).sections, currency: /^[A-Z]{3}$/.test(String(b?.currency)) ? b.currency : '' };
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0 O 1 I
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));
export const makeCode = () => Array.from(rand(4), b => CODE_ALPHABET[b % 32]).join('');
export const makeToken = () => Array.from(rand(24), b => b.toString(16).padStart(2, '0')).join('');

export interface OrderLine { s: number; i: number; name: string; price: number; qty: number }
export interface NewOrder { type: 'dine_in' | 'takeaway'; table_no: string | null; pickup_time: string | null; name: string; phone: string; note: string | null; items: OrderLine[]; total: number; currency: string; idem: string | null }
export type Checked = { error: string; status: number } | { spam: true } | { order: NewOrder };

const clean = (v: unknown, max: number) => String(v ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * body: { items: [{ s, i, k, q }], type, table, pickup, name, phone, note, idem, _hp }  (k = the item's base-language name, to catch a menu edited since the guest loaded it)
 * d: the stored page content. Returns the order to store, or a message for the guest.
 */
export function validateOrder(body: any, d: any): Checked {
  if (clean(body?.[HONEYPOT], 20)) return { spam: true };
  const { sections, currency } = orderMenu(d);
  const lines = new Map<string, OrderLine>();
  const raw = Array.isArray(body?.items) ? body.items : [];
  if (!raw.length || raw.length > LIMITS.lines) return { error: 'Add between 1 and 40 items.', status: 400 };
  for (const r of raw) {
    const s = Number(r?.s), i = Number(r?.i), q = Number(r?.q);
    if (!Number.isInteger(s) || !Number.isInteger(i) || !Number.isInteger(q) || q < 1 || q > LIMITS.qty) return { error: 'Check the quantities (1 to 20 each).', status: 400 };
    const it = sections[s]?.items[i];
    if (!it) return { error: 'The menu changed. Please reload the page and order again.', status: 409 };
    if (clean(r?.k, 80) !== it.name) return { error: 'The menu changed. Please reload the page and order again.', status: 409 };
    const key = `${s}.${i}`, have = lines.get(key);
    const qty = Math.min(LIMITS.qty, (have?.qty || 0) + q);
    lines.set(key, { s, i, name: it.name, price: parsePrice(it.price), qty });
  }
  const items = [...lines.values()];
  const total = Math.round(items.reduce((a, l) => a + l.price * l.qty, 0) * 100) / 100;
  if (total > LIMITS.total) return { error: 'That order is too large.', status: 400 };
  const name = clean(body?.name, LIMITS.name);
  if (!name) return { error: 'Please enter your name.', status: 400 };
  const phone = String(body?.phone ?? '').replace(/[^\d+()\s-]/g, '').trim().slice(0, 20);
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return { error: 'Please enter a valid phone number.', status: 400 };
  const type = body?.type === 'dine_in' ? 'dine_in' : body?.type === 'takeaway' ? 'takeaway' : null;
  if (!type) return { error: 'Choose dine-in or takeaway.', status: 400 };
  const table_no = type === 'dine_in' ? clean(body?.table, LIMITS.table) : '';
  if (type === 'dine_in' && !table_no) return { error: 'Please enter your table number.', status: 400 };
  const idem = /^[\w-]{8,64}$/.test(String(body?.idem ?? '')) ? String(body.idem) : null;
  return { order: { type, table_no: table_no || null, pickup_time: type === 'takeaway' ? clean(body?.pickup, LIMITS.pickup) || null : null, name, phone, note: clean(body?.note, LIMITS.note) || null, items, total, currency, idem } };
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('orders.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  const d = { blocks: [{ kind: 'header', name: 'X' }, { kind: 'menu', currency: 'LKR', sections: [{ name: 'Mains', items: [{ name: 'Rice', price: '1,200.50' }, { name: 'Tea', price: 'LKR 150' }, { name: 'Special', price: 'Market price' }] }] }] };
  const ok = { type: 'dine_in', table: '5', name: ' Ann ', phone: '+94 77 123 4567', idem: 'abcdefgh1', items: [{ s: 0, i: 0, k: 'Rice', q: 2 }, { s: 0, i: 1, k: 'Tea', q: 1 }, { s: 0, i: 0, k: 'Rice', q: 1, price: 1 }] };
  const r: any = validateOrder(ok, d);
  assert(r.order && r.order.total === 3751.5 && r.order.items.length === 2 && r.order.items[0].qty === 3 && r.order.currency === 'LKR', 'priced from the menu, duplicates summed: ' + JSON.stringify(r));
  assert(r.order.name === 'Ann' && r.order.table_no === '5' && r.order.pickup_time === null, 'dine-in keeps table');
  assert(validateOrder({ ...ok, items: [{ s: 0, i: 0, k: 'Rice', q: 21 }] }, d).hasOwnProperty('error'), 'qty 21 refused');
  assert(validateOrder({ ...ok, items: Array.from({ length: 41 }, () => ({ s: 0, i: 0, k: 'Rice', q: 1 })) }, d).hasOwnProperty('error'), '41 lines refused');
  assert((validateOrder({ ...ok, items: [{ s: 3, i: 0, k: 'Rice', q: 1 }] }, d) as any).status === 409, 'unknown ref is a stale menu');
  assert((validateOrder({ ...ok, items: [{ s: 0, i: 0, k: 'Rice pudding', q: 1 }] }, d) as any).status === 409, 'renamed item is a stale menu');
  assert((validateOrder({ ...ok, phone: '12ab' }, d) as any).error && (validateOrder({ ...ok, name: '<b></b>' }, d) as any).error, 'bad phone and empty name refused');
  assert((validateOrder({ ...ok, table: '' }, d) as any).error, 'dine-in needs a table');
  const t: any = validateOrder({ ...ok, type: 'takeaway', table: '', pickup: '6 pm' }, d);
  assert(t.order.table_no === null && t.order.pickup_time === '6 pm', 'takeaway needs no table');
  assert((validateOrder({ ...ok, [HONEYPOT]: 'bot' }, d) as any).spam === true, 'honeypot');
  assert((validateOrder({ ...ok, type: 'x' }, d) as any).error, 'type must be known');
  assert((validateOrder({ ...ok, items: [{ s: 0, i: 2, k: 'Special', q: 1 }] }, d) as any).order.total === 0, 'unpriced item is 0');
  assert(parsePrice('-5') === 5 && parsePrice('1e9') === 1 && parsePrice('') === 0, 'parsePrice');
  assert(canMove('new', 'accepted') && canMove('new', 'ready') && canMove('cooking', 'cancelled') && canMove('new', 'rejected'), 'forward and out');
  assert(!canMove('delivered', 'cooking') && !canMove('cancelled', 'new') && !canMove('cooking', 'new') && !canMove('new', 'new') && !canMove('delivered', 'cancelled'), 'closed and backwards refused');
  assert(/^[A-HJ-NP-Z2-9]{4}$/.test(makeCode()) && /^[0-9a-f]{48}$/.test(makeToken()) && makeToken() !== makeToken(), 'code and token');
  console.log('orders self-check ok');
}
