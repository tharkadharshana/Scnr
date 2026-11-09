import { apiFetch } from './api';
import type { BillingInterval, Currency, PaidPlan } from './plans';

/**
 * Start a paid-plan checkout via the gateway the server picked for this currency (planData.gateways).
 * PayHere: hosted form post. Polar / Lemon Squeezy: redirect to a card checkout (always charged in USD).
 * Shared by Pricing and Billing.
 */
export async function startCheckout(
  plan: PaidPlan,
  interval: BillingInterval,
  currency: Currency,
  planData: { is_sandbox?: boolean; gateways?: Record<Currency, 'payhere' | 'polar' | 'lemonsqueezy'> } | null,
): Promise<void> {
  const gateway = planData?.gateways?.[currency] ?? 'payhere';
  if (gateway !== 'payhere') {
    const { url } = await apiFetch<{ url: string }>(`/api/billing/${gateway}/checkout`, {
      method: 'POST',
      body: JSON.stringify({ plan, interval }),
    });
    window.location.href = url;
    return;
  }

  const data = await apiFetch<Record<string, string>>('/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan, interval, currency }),
  });
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = planData?.is_sandbox ? 'https://sandbox.payhere.lk/pay/checkout' : 'https://www.payhere.lk/pay/checkout';
  for (const [name, value] of Object.entries(data)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
