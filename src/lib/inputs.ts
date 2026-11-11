// Keystroke filters for typed values: phone fields (type="tel") take digits, +, spaces, brackets and dashes; money fields
// (inputMode="decimal") take digits, . , spaces and a currency symbol. One delegated listener covers every such input in the app.
// Self-check: npx tsx src/lib/inputs.ts
export const cleanPhone = (v: string) => v.replace(/[^\d+()\s-]/g, '').replace(/(?!^)\+/g, '').slice(0, 20);
export const cleanMoney = (v: string) => v.replace(/[^\d.,\s$€£¥₹₨]/g, '').slice(0, 24);

/** Installs the filters once. It runs in the capture phase and writes with the native setter, so React's onChange sees the cleaned value. */
export function installInputGuards() {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  document.addEventListener('input', e => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    const clean = el.type === 'tel' ? cleanPhone : el.inputMode === 'decimal' ? cleanMoney : null;
    if (!clean) return;
    const v = clean(el.value);
    if (v === el.value) return;
    const at = (el.selectionStart ?? v.length) - (el.value.length - v.length);
    set.call(el, v);
    el.setSelectionRange(Math.max(0, at), Math.max(0, at));
  }, true);
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('inputs.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  assert(cleanPhone('+94 (77) 123-4567abc') === '+94 (77) 123-4567', 'phone keeps digits and separators, drops letters');
  assert(cleanPhone('9+4+') === '94' && cleanPhone('x'.repeat(30)) === '' && cleanPhone('1'.repeat(30)).length === 20, 'phone: + only first, capped');
  assert(cleanMoney('LKR 1,250.50') === ' 1,250.50' && cleanMoney('$4.50') === '$4.50' && cleanMoney('12abc') === '12', 'money drops letters, keeps symbol');
  console.log('inputs self-check ok');
}
