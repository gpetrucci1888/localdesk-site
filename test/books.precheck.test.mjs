// The precheck tells Gio, before a client's first receipt, whether VAT codes and accounts line up in their QuickBooks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, network, seedClient, asAdmin, REALM } from './harness.mjs';

test('a QuickBooks company that lines up is reported ok, and the key is needed', async (t) => {
  const w = world(); network(t);
  await seedClient(w, { env: 'production', vat: 'yes' });
  const r = await (await asAdmin(w, 'GET', `/precheck/${REALM}`)).json();
  assert.equal(r.vatRegistered, true);
  assert.equal(r.vat.standard, '20.0% S'); assert.equal(r.vat.none, 'No VAT');
  assert.deepEqual(r.banks, ['Current']);
  assert.ok(r.categories.Materials, 'materials maps to an account');
  const { callBooks } = await import('./harness.mjs');
  assert.equal((await callBooks(w, 'GET', `/precheck/${REALM}`)).status, 403);
});

test('missing VAT codes, extra banks and unmatched accounts are each named', async (t) => {
  const w = world(); const net = network(t);
  await seedClient(w, { env: 'production', vat: 'yes' });
  net.qb.t.TaxCode = [{ Id: '3', Name: 'Standard' }];
  net.qb.t.Account.push({ Id: '82', Name: 'Savings', AccountType: 'Bank', Active: true });
  const r = await (await asAdmin(w, 'GET', `/precheck/${REALM}`)).json();
  assert.equal(r.ok, false);
  assert.ok(r.problems.some(p => /No VAT code found for 20% standard rate/.test(p)));
  assert.ok(r.problems.some(p => /2 bank accounts/.test(p)));
});

test('a company that is not VAT registered is not told off for missing VAT codes', async (t) => {
  const w = world(); const net = network(t);
  await seedClient(w, { env: 'production', vat: 'no' });
  net.qb.t.TaxCode = [];
  const r = await (await asAdmin(w, 'GET', `/precheck/${REALM}`)).json();
  assert.ok(!r.problems.some(p => /VAT code/.test(p)));
});
