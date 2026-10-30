// Acceptance: a fictional website enquiry can be followed through the pipeline and onboarding in HQ to an accurate paying status.
// Real Books connector and real HQ worker, fake Stripe and fake texting. No real person is ever contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import hq, { Vault, totp } from '../workers/hq/worker.js';
import books from '../workers/books/worker.js';
import { world, network, ADMIN, MemStorage } from './harness.mjs';

const PASS = 'correct horse battery staple';
const sub = (id, status, nickname, amount, who, product = /books/i.test(nickname) ? 'books' : 'receptionist', invoice = 'paid') => ({ id, status, created: 1790000000, customer: { name: who, email: `${id}@example.test` }, latest_invoice: { status: invoice }, items: { data: [{ quantity: 1, price: { id: `price_${id}`, unit_amount: amount, nickname, product: product ? { metadata: { localdesk_product: product } } : 'prod_x', recurring: { interval: 'month' } } }] } });

async function setup(t) {
  const w = world(); const { log } = network(t);
  const subs = [];
  const prior = globalThis.fetch;
  globalThis.fetch = async (u, init) => String(u).includes('api.stripe.com') ? (String(u).includes('/subscriptions') ? Response.json({ data: subs }) : Response.json({ data: [] })) : prior(u, init);
  t.after(() => { globalThis.fetch = prior; });
  const storage = new MemStorage(), vault = new Vault({ storage });
  const env = { OWNER_PASSWORD: PASS, ADMIN_KEY: ADMIN, STRIPE_KEY: 'rk_test_x', VAULT: { idFromName: () => 'o', get: () => ({ fetch: (u, init) => vault.fetch(new Request(u, init)) }) },
    BOOKS: { fetch: (u, init) => books.fetch(new Request(u, init), w.booksEnv) } };
  const call = (path, { method = 'GET', form, cookie } = {}) => hq.fetch(new Request('https://hq.test' + path, { method, redirect: 'manual', headers: { ...(cookie ? { Cookie: cookie } : {}), 'CF-Connecting-IP': '203.0.113.9', ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body: form ? new URLSearchParams(form).toString() : undefined }), env);
  const first = await call('/login', { method: 'POST', form: { password: PASS } });
  const key = /class="key">([A-Z2-7]{32})</.exec(await first.text())[1];
  const ok = await call('/login', { method: 'POST', form: { password: PASS, code: await totp(key, Math.floor(Date.now() / 30000)) } });
  const cookie = (ok.headers.get('set-cookie') || '').split(';')[0];
  const fresh = async () => { for (const k of [...storage.keys()]) if (k.startsWith('cache:sc:')) await storage.delete(k); };   // HQ keeps Stripe answers for 5 minutes
  return { w, log, subs, fresh, env, call: (p, o = {}) => call(p, { ...o, cookie }) };
}
const enquire = (w, body) => books.fetch(new Request('https://books.test/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://www.localdeskai.co.uk', 'CF-Connecting-IP': '203.0.113.5' }, body: JSON.stringify(body) }), w.booksEnv);
const idFrom = (res) => /\/leads\/([\w-]+)/.exec(res.headers.get('location'))[1];

test('a fictional enquiry travels from the website to a paying Books customer, with nothing sent to them', async (t) => {
  const { w, log, subs, fresh, call } = await setup(t);
  await enquire(w, { name: 'Dave Penrose', phone: '07700 900123', business: 'Penrose Plumbing', product: 'books', message: 'Do you cover Truro?' });

  // 1. It lands in HQ as a lead, and Home tells the owner.
  const home = await (await call('/')).text();
  assert.match(home, /1 new enquiry/);
  const list = await (await call('/leads')).text();
  assert.match(list, /Dave Penrose/); assert.match(list, /New enquiry/); assert.match(list, /Nothing is ever sent to them automatically/);
  const id = /href="\/leads\/(?!new")([\w-]+)"/.exec(list)[1];

  // 2. The lead page offers an editable draft and says nothing is sent.
  const page = await (await call(`/leads/${id}`)).text();
  assert.match(page, /Nothing is sent from here/); assert.match(page, /<textarea id="d"[^>]*>Hi Dave, it&#39;s Gio from Localdesk/);
  assert.match(page, /Do you cover Truro\?/); assert.match(page, /Open in Messages/);

  // 3. Move it along. Paying is not offered until onboarding.
  assert.doesNotMatch(page, /value="paying"/);
  for (const s of ['contacted', 'demo', 'trial', 'onboarding']) {
    const r = await call(`/leads/${id}/save`, { method: 'POST', form: { status: s } });
    assert.equal(r.status, 303, s);
  }
  const onb = await (await call(`/leads/${id}`)).text();
  assert.match(onb, /value="paying"/); assert.match(onb, /Onboarding checklist/); assert.match(onb, /Agreement signed/); assert.match(onb, /Make the connect link/);
  assert.match(onb, /href="\/books\/new\?name=Penrose%20Plumbing&amp;phone=07700%20900123"/);

  // 4. Tick checklist items, add a note and a follow-up date.
  await call(`/leads/${id}/save`, { method: 'POST', form: { checklist_form: '1', ck_agreement: '1', ck_payment: '1' } });
  await call(`/leads/${id}/save`, { method: 'POST', form: { notes: 'Wants QuickBooks', next_at: '2026-11-12', draft: 'Edited draft text' } });
  const saved = await (await call(`/leads/${id}`)).text();
  assert.match(saved, /2 of 10 done/); assert.match(saved, /Edited draft text/); assert.match(saved, /Wants QuickBooks/);

  // 5. The business connect form opens with their details filled in.
  const form = await (await call('/books/new?name=Penrose%20Plumbing&phone=07700%20900123')).text();
  assert.match(form, /value="Penrose Plumbing"/); assert.match(form, /value="07700 900123"/);

  // 6. Marking the lead as paying does NOT change the money figures: only Stripe does.
  assert.equal((await call(`/leads/${id}/save`, { method: 'POST', form: { status: 'paying' } })).status, 303);
  let h = await (await call('/')).text();
  assert.match(h, /0 of 20 paying/); assert.doesNotMatch(h, /£150/);
  subs.push(sub('s1', 'trialing', 'Books monthly', 15000, 'Penrose Plumbing')); await fresh();
  h = await (await call('/')).text();
  assert.doesNotMatch(h, /£150/, 'a trial is not income'); assert.match(h, /1 on trial/);
  subs[0].status = 'active'; await fresh();
  h = await (await call('/')).text();
  assert.match(h, /£150/); assert.match(h, /1 of 20 paying, 19 to go/); assert.match(h, /0 of 20 paying/);
  subs.push(sub('s2', 'active', 'Receptionist', 39700, 'Real Roofer'), sub('s3', 'past_due', 'Receptionist', 39700, 'Late Payer'), sub('s4', 'active', 'Free', 0, 'Nil')); await fresh();
  h = await (await call('/')).text();
  assert.match(h, /£547/); assert.match(h, /1 of 20 paying/); assert.match(h, /1 with a failed payment/);

  // 7. No text ever went to the lead. The only message was the one to the owner about the enquiry.
  assert.equal(log.sms.length, 1); assert.ok(log.sms.every(m => m.To === '+447700900001'));
  assert.ok(log.sms.every(m => !/Edited draft/.test(m.Body)));
});

test('a lost lead is kept apart, can be reopened, and deleting needs a tick', async (t) => {
  const { w, call } = await setup(t);
  await enquire(w, { name: 'Sam Roofer', phone: '07700 900456', product: 'receptionist', message: '' });
  const id = /href="\/leads\/(?!new")([\w-]+)"/.exec(await (await call('/leads')).text())[1];
  await call(`/leads/${id}/save`, { method: 'POST', form: { status: 'lost' } });
  const l = await (await call('/leads')).text(); assert.match(l, /Lost \(1\)/);
  assert.match(await (await call(`/leads/${id}`)).text(), /Reopen as New enquiry/);
  assert.equal((await call(`/leads/${id}/save`, { method: 'POST', form: { status: 'paying' } })).status, 400, 'a lost lead cannot jump to paying');
  await call(`/leads/${id}/delete`, { method: 'POST', form: {} });
  assert.equal((await call(`/leads/${id}`)).status, 200, 'not deleted without the tick');
  const d = await call(`/leads/${id}/delete`, { method: 'POST', form: { confirm: 'yes' } });
  assert.equal(d.headers.get('location'), '/leads?done=deleted'); assert.equal((await call(`/leads/${id}`)).status, 404);
});

test('lead pages escape what visitors typed and need a login', async (t) => {
  const { w, call } = await setup(t);
  await enquire(w, { name: '<img src=x onerror=alert(1)>', phone: '07700 900789', business: '"><script>x</script>', product: 'books', message: '<b>hi</b>' });
  const list = await (await call('/leads')).text(); const id = /href="\/leads\/(?!new")([\w-]+)"/.exec(list)[1];
  const page = await (await call(`/leads/${id}`)).text();
  for (const h of [list, page]) { assert.doesNotMatch(h, /<img src=x/); assert.doesNotMatch(h, /<script>x/); assert.ok(!h.includes('<b>hi</b>')); }
  const anon = await hq.fetch(new Request('https://hq.test/leads', { redirect: 'manual' }), { OWNER_PASSWORD: PASS, VAULT: { idFromName: () => 'o', get: () => ({ fetch: async () => Response.json({}) }) }, BOOKS: { fetch: async () => { throw new Error('should not be called'); } } });
  assert.equal(anon.status, 303);
});

test('subscriptions are only counted as a product by verified IDs, and only as paying once the latest invoice is paid', async (t) => {
  const { subs, fresh, env, call } = await setup(t);
  subs.push(
    sub('a1', 'active', 'Books', 15000, 'Name Only Ltd', null),                 // called "Books" but nothing verifies it
    sub('a2', 'active', 'Receptionist', 39700, 'Unpaid Roofer', 'receptionist', 'open'),   // active, latest invoice not paid
    sub('a3', 'active', 'Growth', 39700, 'Paid Roofer', 'receptionist', 'paid'),
    sub('a4', 'active', 'Other thing', 5000, 'Unrelated Customer', 'other'),     // some other Stripe product
  );
  await fresh();
  let h = await (await call('/')).text();
  assert.match(h, /1 of 20 paying/, 'only the verified, paid Receptionist counts'); assert.match(h, /0 of 20 paying/);
  assert.match(h, /£397/); assert.doesNotMatch(h, /£15,0|£447|£794/, 'unknown and unpaid ones are not in the income');
  assert.match(h, /1 active but not yet paid/); assert.match(h, /2 not matched to Receptionist or Books/);
  assert.match(h, /Name Only Ltd \(price price_a1\)/);
  const cust = await (await call('/customers')).text(); assert.match(cust, /2 subscriptions aren&#39;t matched to a product/);
  // Listing the price IDs in the HQ settings makes them count; being listed under both products does not.
  env.STRIPE_PRICES_BOOKS = 'price_a1, price_other'; env.STRIPE_PRICES_RECEPTIONIST = 'price_a2';
  await fresh(); h = await (await call('/')).text();
  assert.match(h, /1 of 20 paying/, 'the named Books price now counts as Books'); assert.match(h, /£547/);   // a1 £150 + a3 £397
  env.STRIPE_PRICES_RECEPTIONIST = 'price_a2, price_a1'; await fresh();
  assert.match(await (await call('/')).text(), /Name Only Ltd/, 'ambiguous price IDs stay unmatched');
});
