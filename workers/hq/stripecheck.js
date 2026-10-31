// "Is Stripe set up right?" Checks the four prices and the two Books secrets without showing any secret, and says in plain words
// what to fix. Uses only the read-only key HQ already has. It cannot see whether the webhook endpoint is registered (a read-only key
// cannot list webhooks), so that one line stays a manual check in the Stripe dashboard.
export const ENV_NAME = { receptionist: 'STRIPE_PRICE_RECEPTIONIST', receptionist_setup: 'STRIPE_PRICE_RECEPTIONIST_SETUP', books: 'STRIPE_PRICE_BOOKS', books_setup: 'STRIPE_PRICE_BOOKS_SETUP' };
export const EXPECTED = {
  receptionist: { label: 'Receptionist, monthly', amount: 39700, monthly: true },
  receptionist_setup: { label: 'Receptionist, setup fee (invoiced when the trial ends; waived for the first five)', amount: 49700, monthly: false },
  books: { label: 'Books, monthly', amount: 15000, monthly: true },
  books_setup: { label: 'Books, setup fee', amount: 39500, monthly: false },
};
export const keyMode = (key) => !key ? 'none' : /_test_/.test(key) ? 'test' : /_live_/.test(key) ? 'live' : 'unknown';
const pounds = (p) => `£${(p / 100).toFixed(p % 100 ? 2 : 0)}`;

// status: from the Books worker ({ secretKey, webhookSecret, prices }). fetched: { key: stripePriceObject | { error } | undefined }.
export function evaluate({ status, fetched = {}, hqKey, hqMonthlyIds = new Set() }) {
  const mode = keyMode(hqKey), general = [], rows = [];
  if (!status) general.push({ bad: true, text: 'Could not ask the Books worker how Stripe is set up. Try again in a minute.' });
  else {
    general.push(status.secretKey ? { ok: true, text: 'Books has its Stripe key for making payment links.' } : { bad: true, text: 'Books has no STRIPE_SECRET_KEY yet (a restricted key that can only write Checkout Sessions). Add it in Cloudflare, books, Variables and Secrets.' });
    general.push(status.webhookSecret ? { ok: true, text: 'Books has the webhook signing secret.' } : { bad: true, text: 'Books has no STRIPE_WEBHOOK_SECRET yet. Add the signing secret from the Stripe webhook in Cloudflare, books.' });
  }
  if (mode === 'none') general.push({ bad: true, text: 'HQ has no read-only STRIPE_KEY yet, so the prices cannot be checked and revenue is blank. Add it in Cloudflare, hq.' });
  else if (mode === 'unknown') general.push({ bad: true, text: 'The HQ Stripe key does not look like a Stripe key (it should start with rk_ or sk_).' });
  else general.push({ ok: mode === 'test', warn: mode === 'live', text: mode === 'test' ? 'Stripe is in TEST mode: no real money moves. This is where to practise.' : 'Stripe is in LIVE mode: real cards and real money. Finish the test checks first.' });
  for (const [k, want] of Object.entries(EXPECTED)) {
    const id = status && status.prices ? status.prices[k] : null, p = fetched[k], problems = [];
    if (status && !id) problems.push(`Not set. Add the price id as ${ENV_NAME[k]} in Cloudflare, books.`);
    else if (id && mode !== 'none' && mode !== 'unknown') {
      if (!p || p.error) problems.push(`Stripe could not find ${id}. Check the id, and that it is from the same mode (test or live) as the HQ key.`);
      else {
        if (p.currency !== 'gbp') problems.push(`Currency is ${String(p.currency || '?').toUpperCase()}, it should be GBP.`);
        if (p.unit_amount !== want.amount) problems.push(`Amount is ${p.unit_amount == null ? 'not fixed' : pounds(p.unit_amount)}, it should be ${pounds(want.amount)}.`);
        const monthly = !!(p.recurring && p.recurring.interval === 'month' && (p.recurring.interval_count || 1) === 1);
        if (want.monthly && !monthly) problems.push('It should repeat every month.');
        if (!want.monthly && p.recurring) problems.push('It should be a one-off price, not repeating.');
        if (p.active === false) problems.push('The price is archived in Stripe.');
        if (typeof p.livemode === 'boolean' && ((mode === 'test' && p.livemode) || (mode === 'live' && !p.livemode))) problems.push('This price is from the other mode (test or live) than the HQ key.');
        if (want.monthly && hqMonthlyIds.size && !hqMonthlyIds.has(id)) problems.push(`HQ does not count subscriptions on this price yet. Add ${id} to ${k === 'books' ? 'STRIPE_PRICES_BOOKS' : 'STRIPE_PRICES_RECEPTIONIST'} in Cloudflare, hq.`);
        if (want.monthly && !hqMonthlyIds.size) problems.push(`HQ is not told which prices are ${k === 'books' ? 'Books' : 'Receptionist'}. Add ${id} to ${k === 'books' ? 'STRIPE_PRICES_BOOKS' : 'STRIPE_PRICES_RECEPTIONIST'} in Cloudflare, hq.`);
      }
    }
    rows.push({ key: k, label: want.label, id, expected: `${pounds(want.amount)}${want.monthly ? ' a month' : ' once'}`, problems, unchecked: !!id && (mode === 'none' || mode === 'unknown') });
  }
  const ready = general.every(g => !g.bad) && rows.every(r => !r.problems.length && !r.unchecked);
  return { mode, general, rows, ready };
}
