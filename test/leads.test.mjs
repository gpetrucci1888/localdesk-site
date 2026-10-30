// Sales pipeline in the Books connector: website enquiries become leads, statuses move sensibly, nobody is ever contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, network, asAdmin, callBooks, runCron } from './harness.mjs';
import books from '../workers/books/worker.js';

const enquire = (w, body, ip = '203.0.113.5') => books.fetch(new Request('https://books.test/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://www.localdeskai.co.uk', 'CF-Connecting-IP': ip }, body: JSON.stringify(body) }), w.booksEnv);
const good = { name: 'Dave Penrose', phone: '07700 900123', business: 'Penrose Plumbing', product: 'books', message: 'Do you cover Truro?' };
const leads = async (w) => (await asAdmin(w, 'GET', '/leads')).json();
const move = (w, id, status) => asAdmin(w, 'PUT', `/leads/${id}`, { status });

test('a website enquiry becomes a new lead, the owner is texted, and the lead is never texted', async (t) => {
  const w = world(); const { log } = network(t);
  await enquire(w, good);
  const [l] = await leads(w);
  assert.equal(l.status, 'new'); assert.equal(l.product, 'books'); assert.equal(l.source, 'website'); assert.equal(l.name, 'Dave Penrose');
  assert.equal(l.messages[0].text, 'Do you cover Truro?'); assert.equal(l.history.length, 1); assert.ok(l.next_at);
  assert.equal(log.sms.length, 1); assert.equal(log.sms[0].To, '+447700900001', 'only the owner is texted');
});

test('spam and bad enquiries never become leads, and the same person asking again joins their lead', async (t) => {
  const w = world(); network(t);
  await enquire(w, { ...good, website: 'http://spam.example' }); await enquire(w, { ...good, name: 'x' }); await enquire(w, { ...good, phone: '123' });
  assert.equal((await leads(w)).length, 0);
  await enquire(w, good); await enquire(w, { ...good, phone: '+44 7700 900123', message: 'Also quotes please' });
  const all = await leads(w); assert.equal(all.length, 1); assert.equal(all[0].repeat, 2); assert.equal(all[0].messages.length, 2);
});

test('leads are admin-only', async (t) => {
  const w = world(); network(t); await enquire(w, good);
  for (const [m, p] of [['GET', '/leads'], ['POST', '/leads'], ['GET', '/leads/abc'], ['PUT', '/leads/abc'], ['DELETE', '/leads/abc']]) assert.equal((await callBooks(w, m, p, { key: 'wrong', body: m === 'GET' ? undefined : {} })).status, 403, `${m} ${p}`);
  assert.equal((await callBooks(w, 'GET', '/leads')).status, 403);
});

test('status moves forward, back one step, to lost from anywhere, and paying only from onboarding', async (t) => {
  const w = world(); network(t); await enquire(w, good);
  const id = (await leads(w))[0].id;
  assert.equal((await move(w, id, 'paying')).status, 500, 'not straight to paying');
  for (const s of ['contacted', 'demo', 'trial', 'onboarding']) assert.equal((await move(w, id, s)).status, 200, s);
  assert.equal((await move(w, id, 'new')).status, 500, 'not back more than one step');
  assert.equal((await move(w, id, 'trial')).status, 200); assert.equal((await move(w, id, 'onboarding')).status, 200);
  assert.equal((await move(w, id, 'paying')).status, 200);
  const l = await (await asAdmin(w, 'GET', `/leads/${id}`)).json();
  assert.deepEqual(l.history.map(h => h.to), ['new', 'contacted', 'demo', 'trial', 'onboarding', 'trial', 'onboarding', 'paying']);
  assert.equal(l.next_at, '', 'nothing left to follow up once paying');
  assert.equal((await move(w, id, 'lost')).status, 200);
  assert.equal((await move(w, id, 'trial')).status, 500, 'a lost lead reopens at new or contacted only');
  assert.equal((await move(w, id, 'contacted')).status, 200);
  assert.equal((await move(w, id, 'banana')).status, 500);
});

test('a status change sets a sensible follow-up date, and notes, drafts, dates and the onboarding checklist save safely', async (t) => {
  const w = world(); network(t); await enquire(w, good);
  const id = (await leads(w))[0].id;
  await move(w, id, 'contacted');
  const l = await (await asAdmin(w, 'GET', `/leads/${id}`)).json();
  assert.equal(l.next_at, new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)); assert.ok(l.last_contacted);
  const r = await asAdmin(w, 'PUT', `/leads/${id}`, { notes: 'Rang back, wants a demo Friday', draft: 'Hi Dave, thanks for your enquiry...', next_at: '2026-11-07', checklist: { agreement: true, bad_key_X: true, 'a b': true } });
  assert.equal(r.status, 200); const s = await r.json();
  assert.equal(s.notes, 'Rang back, wants a demo Friday'); assert.equal(s.next_at, '2026-11-07'); assert.equal(s.checklist.agreement, true);
  assert.equal(s.checklist.bad_key_X, undefined, 'only simple keys are kept');
  assert.equal((await asAdmin(w, 'PUT', `/leads/${id}`, { next_at: 'tomorrow' })).status, 500);
  assert.equal((await asAdmin(w, 'PUT', `/leads/${id}`, { phone: '123' })).status, 500);
  assert.equal((await asAdmin(w, 'PUT', '/leads/nope', { notes: 'x' })).status, 500);
});

test('a lead can be added by hand, deleted on request, and old lost leads are cleared out while live ones stay', async (t) => {
  const w = world(); const { log } = network(t);
  const made = await (await asAdmin(w, 'POST', '/leads', { name: 'Sam Roofer', phone: '07700 900456', product: 'receptionist', source: 'phone call' })).json();
  assert.ok(made.id); assert.equal((await leads(w))[0].source, 'phone call'); assert.equal(log.sms.length, 0, 'adding a lead sends nothing');
  assert.equal((await asAdmin(w, 'POST', '/leads', { name: 'S', phone: '1' })).status, 500);
  const del = await asAdmin(w, 'DELETE', `/leads/${made.id}`); assert.equal(del.status, 200); assert.equal((await leads(w)).length, 0);
  await w.storage.put('lead:old-lost', { id: 'old-lost', status: 'lost', updated: Date.now() - 91 * 86400000, created: 1 });
  await w.storage.put('lead:old-live', { id: 'old-live', status: 'trial', updated: Date.now() - 91 * 86400000, created: 1 });
  await runCron(w, '0 7 * * *');
  assert.equal(await w.storage.get('lead:old-lost'), undefined); assert.ok(await w.storage.get('lead:old-live'));
});

test('leads are in the backup', async (t) => {
  const w = world(); network(t); await enquire(w, good);
  const b = await (await asAdmin(w, 'GET', '/backup')).json();
  assert.ok(Object.keys(b.entries || b).some(k => k.startsWith('lead:')));
});
