// VAT codes: matched by shape, rates 20/5/0/none supported on invoices, and a missing code is an error, never silent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, network, seedClient, seedSession, callBooks } from './harness.mjs';

async function setup(t, codes, vat = 'yes') {
  const w = world(); const net = network(t);
  const c = await seedClient(w, { env: 'production', vat });
  const session = await seedSession(w, c.appKey);
  if (codes) net.qb.t.TaxCode = codes;
  const invoice = (extra) => callBooks(w, 'POST', '/c/invoice', { headers: { 'X-App': c.appKey, 'X-Session': session }, body: { customer: 'Synthetic Customer', description: 'Job', amount: 100, ...extra } });
  return { w, net, invoice };
}
const usedCode = (net) => net.qb.t.Invoice.at(-1).Line.find(l => l.SalesItemLineDetail).SalesItemLineDetail.TaxCodeRef;

test('a real company\'s code names (different spacing and decimals) are still found', async (t) => {
  const { net, invoice } = await setup(t, [{ Id: '31', Name: '20% S' }, { Id: '32', Name: '5 % R' }, { Id: '33', Name: '0.0% Z' }, { Id: '34', Name: 'No VAT' }]);
  const r = await invoice({ vat: true });
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal(usedCode(net).value, '31');
});

test('invoices can be 20%, 5%, 0% or no VAT', async (t) => {
  const { net, invoice } = await setup(t, [{ Id: '3', Name: '20.0% S' }, { Id: '8', Name: '5.0% R' }, { Id: '9', Name: '0.0% Z' }, { Id: '12', Name: 'No VAT' }]);
  for (const [vatRate, want] of [['standard', '3'], ['reduced', '8'], ['zero', '9'], ['none', '12']]) {
    assert.equal((await invoice({ vatRate })).status, 200, vatRate);
    assert.equal(usedCode(net).value, want, vatRate);
  }
  assert.equal((await invoice({ vat: true })).status, 200); assert.equal(usedCode(net).value, '3', 'the old yes/no switch still means 20%');
  assert.equal((await invoice({})).status, 200); assert.equal(usedCode(net).value, '12', 'and no switch means no VAT');
});

test('a VAT-registered company with no matching code gets a plain error and nothing is created', async (t) => {
  const { net, invoice } = await setup(t, [{ Id: '3', Name: 'Standard rate' }, { Id: '12', Name: 'No VAT' }]);
  const r = await invoice({ vat: true });
  assert.equal(r.status, 500);
  assert.match(await r.text(), /no VAT code for 20% standard rate, so nothing was saved/);
  assert.equal(net.qb.t.Invoice.length, 0);
});

test('an inactive code is not used', async (t) => {
  const { net, invoice } = await setup(t, [{ Id: '3', Name: '20.0% S', Active: false }, { Id: '12', Name: 'No VAT' }]);
  assert.equal((await invoice({ vat: true })).status, 500);
  assert.equal(net.qb.t.Invoice.length, 0);
});

test('a company that is not VAT registered never touches VAT codes', async (t) => {
  const { net, invoice } = await setup(t, [], 'no');
  const r = await invoice({ vat: true });
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal(usedCode(net), undefined);
});
