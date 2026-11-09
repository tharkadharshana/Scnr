import type { Currency } from './plans.js';

// Which payment gateway serves a currency: LKR = Sri Lanka customers, USD = international customers.
// Server-only (reads env); the browser gets the result from /api/plan.
export type Gateway = 'payhere' | 'polar' | 'lemonsqueezy';
export const GATEWAYS: readonly Gateway[] = ['payhere', 'polar', 'lemonsqueezy'];

/**
 * BILLING_GATEWAY_LKR / BILLING_GATEWAY_USD pick the gateway. Unset or invalid falls back to:
 * LKR → payhere; USD → polar, else lemonsqueezy (whichever has an API key), else payhere.
 * Card gateways (polar, lemonsqueezy) always charge USD.
 */
export function pickGateway(env: Record<string, string | undefined>, currency: Currency): Gateway {
  const v = env[currency === 'LKR' ? 'BILLING_GATEWAY_LKR' : 'BILLING_GATEWAY_USD']?.trim().toLowerCase();
  if (GATEWAYS.includes(v as Gateway)) return v as Gateway;
  if (currency === 'LKR') return 'payhere';
  return env.POLAR_ACCESS_TOKEN ? 'polar' : env.LEMONSQUEEZY_API_KEY ? 'lemonsqueezy' : 'payhere';
}

/** Self-check: npx tsx src/lib/gateway.ts */
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('gateway.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  assert(pickGateway({}, 'LKR') === 'payhere' && pickGateway({}, 'USD') === 'payhere', 'defaults');
  assert(pickGateway({ POLAR_ACCESS_TOKEN: 'x' }, 'USD') === 'polar', 'polar key → polar');
  assert(pickGateway({ LEMONSQUEEZY_API_KEY: 'x' }, 'USD') === 'lemonsqueezy', 'ls key → ls');
  assert(pickGateway({ POLAR_ACCESS_TOKEN: 'x', LEMONSQUEEZY_API_KEY: 'x' }, 'USD') === 'polar', 'polar wins the default');
  assert(pickGateway({ BILLING_GATEWAY_USD: 'LemonSqueezy ', POLAR_ACCESS_TOKEN: 'x' }, 'USD') === 'lemonsqueezy', 'explicit wins, trimmed, case-insensitive');
  assert(pickGateway({ BILLING_GATEWAY_LKR: 'polar' }, 'LKR') === 'polar', 'LKR can use a card gateway');
  assert(pickGateway({ BILLING_GATEWAY_LKR: 'stripe', BILLING_GATEWAY_USD: '' }, 'LKR') === 'payhere', 'invalid → default');
  assert(pickGateway({ BILLING_GATEWAY_USD: 'lemonsqueezy' }, 'LKR') === 'payhere', 'currencies independent');
  console.log('gateway self-check ok');
}
