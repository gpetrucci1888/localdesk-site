// Xero as a third bookkeeping platform for Books. Same shape as freeagent.js: worker.js asks this module only when a client's
// saved connection says platform "xero". Follows Xero's public Accounting API (OAuth 2.0 code flow):
//   authorise  GET  https://login.xero.com/identity/connect/authorize     token  POST https://identity.xero.com/connect/token (HTTP Basic)
//   calls      https://api.xero.com/api.xro/2.0/<path> with a Bearer token and an xero-tenant-id header.
// Xero refresh tokens are SINGLE USE (each refresh returns a new one), so a refresh is shared and saved before anything else.
// Settings: XERO_CLIENT_ID / XERO_CLIENT_SECRET. Xero has no separate test site: the "Demo Company" inside a Xero login is the test
// environment, so invites with env "sandbox" are for a demo company and "production" for a real one. XERO_SCOPES overrides the scopes.
const AUTH = 'https://login.xero.com/identity/connect/authorize';
const TOKEN = 'https://identity.xero.com/connect/token';
const API = 'https://api.xero.com/api.xro/2.0';
const UA = 'Localdesk Books (hello@localdeskai.co.uk)';
const SOFTWARE = 'Xero';
export const XERO_SCOPES = 'offline_access accounting.transactions accounting.contacts accounting.settings accounting.attachments accounting.reports.read';

export const xeroCreds = (env) => ({ id: env.XERO_CLIENT_ID, secret: env.XERO_CLIENT_SECRET });
export const xeroAuthorizeUrl = (env, redirectUri, state) =>
  `${AUTH}?${new URLSearchParams({ response_type: 'code', client_id: xeroCreds(env).id || '', redirect_uri: redirectUri, scope: env.XERO_SCOPES || XERO_SCOPES, state })}`;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const day = (s) => String(s || '').slice(0, 10);
const q = (s) => String(s).replace(/"/g, '');
const dt = (iso) => `DateTime(${Number(iso.slice(0, 4))},${Number(iso.slice(5, 7))},${Number(iso.slice(8, 10))})`;
// Route-safe number for a Xero organisation: its id is a GUID, so turn the first 15 hex digits into digits. "77" keeps it apart from the others.
export const xeroRealm = (tenantId) => `77${BigInt('0x' + String(tenantId).replace(/-/g, '').slice(0, 15)).toString()}`;

async function tokenRequest(env, params) {
  const c = xeroCreds(env);
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${c.id}:${c.secret}`), 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': UA },
    body: new URLSearchParams(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Xero said ${res.status}: ${body.error || ''} ${body.error_description || ''}`.trim());
  return body;
}

// After the customer approves: swap the code for tokens, find the organisation they chose, and return what to store.
export async function xeroExchange(env, which, redirectUri, code) {
  const t = await tokenRequest(env, { grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  const h = { Authorization: `Bearer ${t.access_token}`, Accept: 'application/json', 'User-Agent': UA };
  const cr = await fetch('https://api.xero.com/connections', { headers: h });
  if (!cr.ok) throw new Error(`Xero ${cr.status}: couldn't see which organisation was connected`);
  const orgs = (await cr.json()).filter(c => !c.tenantType || c.tenantType === 'ORGANISATION');
  if (!orgs.length) throw new Error('Xero: no organisation was connected');
  const tenant = orgs[0];
  const or = await fetch(`${API}/Organisation`, { headers: { ...h, 'xero-tenant-id': tenant.tenantId } });
  if (!or.ok) throw new Error(`Xero ${or.status}: couldn't read the organisation`);
  const org = ((await or.json()).Organisations || [])[0] || {};
  const now = Date.now();
  return {
    realmId: xeroRealm(tenant.tenantId), company: org.Name || tenant.tenantName || '', connectionId: tenant.id || '',
    tokens: {
      platform: 'xero', env: which, access_token: t.access_token, refresh_token: t.refresh_token,
      expires_at: now + (Number(t.expires_in) || 1800) * 1000, refresh_expires_at: now + 60 * 86400000, saved_at: new Date(now).toISOString(),
      xero_tenant: tenant.tenantId, xero_connection: tenant.id || '', xero_company: org.Name || '', xero_registered: Boolean(org.SalesTaxBasis && org.SalesTaxBasis !== 'NONE'), xero_demo: Boolean(org.IsDemoCompany),
    },
  };
}

// Customer disconnects: Xero lets the app delete its own connection.
export async function xeroDisconnect(t) {
  if (!t || !t.xero_connection) return;
  await fetch(`https://api.xero.com/connections/${t.xero_connection}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t.access_token}`, 'User-Agent': UA } }).catch(() => {});
}

export function createXero(D) { // D: { ACCOUNT_NAMES, getClient, logChange, markUndone, alertOwner, clientName, ukToday, money }
  const saved = async (store, realmId) => { const r = await store.fetch(`https://store/tokens/${realmId}`); return r.ok ? r.json() : null; };

  // Two calls at once share ONE refresh: the refresh token can only be used once.
  const refreshing = new Map();
  function token(env, store, realmId, force) {
    const key = `${realmId}`;
    if (refreshing.has(key)) return refreshing.get(key);
    const p = tokenOnce(env, store, realmId, force).finally(() => refreshing.delete(key));
    refreshing.set(key, p);
    return p;
  }
  async function tokenOnce(env, store, realmId, force) {
    const t = await saved(store, realmId);
    if (!t) throw new Error(`${SOFTWARE} organisation ${realmId} isn't connected`);
    if (!force && t.expires_at - Date.now() > 60_000) return t;
    let fresh;
    try { fresh = await tokenRequest(env, { grant_type: 'refresh_token', refresh_token: t.refresh_token }); } catch (err) {
      if (/invalid_grant|invalid_token|unauthor/i.test(String(err.message))) {
        await store.fetch(`https://store/tokens/${realmId}`, { method: 'DELETE' });
        const cl = await D.getClient(store, realmId);
        if (cl) await store.fetch(`https://store/clients/${realmId}`, { method: 'PUT', body: JSON.stringify({ ...cl, disconnected_at: new Date().toISOString() }) });
      }
      await D.alertOwner(env, store, `conn:${realmId}`, `Books: ${await D.clientName(store, realmId)}'s ${SOFTWARE} connection has dropped (${String(err.message).slice(0, 100)}). They may need a fresh connect link.`).catch(() => {});
      throw err;
    }
    const next = { ...t, access_token: fresh.access_token, refresh_token: fresh.refresh_token || t.refresh_token, expires_at: Date.now() + (Number(fresh.expires_in) || 1800) * 1000, refresh_expires_at: Date.now() + 60 * 86400000 };
    await store.fetch(`https://store/tokens/${realmId}`, { method: 'PUT', body: JSON.stringify(next) });
    return next;
  }

  // One Xero call. 429 means "asking too often": wait as long as Xero says (capped) and ask again, up to 3 more times.
  async function call(env, store, realmId, method, path, body, raw) {
    const t = await token(env, store, realmId);
    let res;
    for (let attempt = 0; ; attempt++) {
      res = await fetch(`${API}${path}`, {
        method, headers: { Authorization: `Bearer ${t.access_token}`, 'xero-tenant-id': t.xero_tenant, Accept: 'application/json', 'Content-Type': raw ? raw.type : 'application/json', 'User-Agent': UA },
        body: raw ? raw.bytes : body ? JSON.stringify(body) : undefined,
      });
      if (res.status !== 429 || attempt >= 3) break;
      await new Promise(r => setTimeout(r, Math.min(5000, (Number(res.headers.get('Retry-After')) || 1) * 1000) + Math.random() * 300));
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msgs = [data.Message, ...[].concat(...(data.Elements || []).map(e => (e.ValidationErrors || []).map(v => v.Message)))].filter(Boolean).join('; ');
      throw new Error(`Xero ${res.status}: ${msgs || data.Detail || data.error_description || 'request failed'}`.trim());
    }
    return data;
  }

  const registered = async (store, realmId, t, client) => {
    const c = client || (await D.getClient(store, realmId)) || {};
    if (c.vat === 'yes') return true;
    if (c.vat === 'no') return false;
    return Boolean((t || (await saved(store, realmId)) || {}).xero_registered);
  };

  const accounts = async (env, store, realmId) => ((await call(env, store, realmId, 'GET', '/Accounts?where=' + encodeURIComponent('Status=="ACTIVE"'))).Accounts || []);
  const expenseAccounts = (all) => all.filter(a => ['EXPENSE', 'DIRECTCOSTS', 'OVERHEADS'].includes(String(a.Type).toUpperCase()) && a.Code);
  async function categories(env, store, realmId) { return expenseAccounts(await accounts(env, store, realmId)); }
  function pickAccount(list, category) {
    const has = (n) => list.find(a => String(a.Name || '').toLowerCase().includes(n));
    for (const n of D.ACCOUNT_NAMES[category] || []) { const a = has(n); if (a) return a; }
    return has('general') || has('sundr') || has('miscell') || list[0];
  }

  async function fileReceipt(env, store, realmId, r) {
    const total = round2(r.total), vat = round2(r.vat);
    if (!(total > 0)) throw new Error('No total on the receipt');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : D.ukToday();
    const supplier = (r.supplier || 'Unknown supplier').trim().slice(0, 100);
    const t = await token(env, store, realmId);
    // Same date, supplier and total already filed: don't file it twice.
    const where = encodeURIComponent(`Type=="SPEND" AND Date==${dt(date)}`);
    const same = (await call(env, store, realmId, 'GET', `/BankTransactions?where=${where}`)).BankTransactions || [];
    const dup = same.find(b => b.Status !== 'DELETED' && Math.abs(Number(b.Total) - total) < 0.005 && String((b.Contact || {}).Name || '').toLowerCase() === supplier.toLowerCase());
    if (dup) return { ok: true, duplicate: true, id: dup.BankTransactionID };
    const all = await accounts(env, store, realmId);
    const acc = pickAccount(expenseAccounts(all), r.category);
    if (!acc) throw new Error('No expense accounts found in Xero');
    const bank = all.find(a => String(a.Type).toUpperCase() === 'BANK');
    if (!bank) throw new Error('No bank account in Xero: add one there so receipts have somewhere to come out of');
    const reg = await registered(store, realmId, t);
    const net = round2(total - vat), rate = reg && vat > 0 && net > 0 ? Math.round((vat / net) * 100) : 0;
    const taxType = reg ? (rate === 20 ? 'INPUT2' : rate === 5 ? 'RRINPUT' : vat > 0 ? 'INPUT2' : 'NONE') : 'NONE';
    const bt = { Type: 'SPEND', Contact: { Name: supplier }, Date: date, LineAmountTypes: 'Inclusive', BankAccount: { AccountID: bank.AccountID }, Reference: 'Books',
      LineItems: [{ Description: `${supplier}${r.items ? ' - ' + r.items : ''}`.slice(0, 250), Quantity: 1, UnitAmount: total, AccountCode: acc.Code, TaxType: taxType }] };
    const created = ((await call(env, store, realmId, 'PUT', '/BankTransactions', bt)).BankTransactions || [])[0];
    if (!created) throw new Error('Xero did not create the expense');
    const id = created.BankTransactionID;
    let attached = false;
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(r.image || '');
    if (m) {
      const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
      await call(env, store, realmId, 'PUT', `/BankTransactions/${id}/Attachments/receipt.${m[1].split('/')[1].replace('jpeg', 'jpg')}`, null, { type: m[1], bytes });
      attached = true;
    }
    await D.logChange(store, realmId, { kind: 'file', ref: id, text: `Filed ${r.supplier || 'an expense'} ${D.money(total)} (${acc.Name})` });
    return { ok: true, id, total, account: acc.Name, vatCode: taxType === 'NONE' ? 'none' : `${rate}%`, attached };
  }

  async function undo(env, store, realmId, id) {
    const log = await store.fetch(`https://store/log/${realmId}`).then(r => r.json()).catch(() => []);
    if (!log.some(e => e.kind === 'file' && String(e.ref) === String(id) && !e.undone)) throw new Error('Only expenses added from the app can be undone here');
    await call(env, store, realmId, 'POST', `/BankTransactions/${id}`, { BankTransactionID: id, Status: 'DELETED' });
    await D.markUndone(store, realmId, 'file', id);
    return { ok: true };
  }

  async function owed(env, store, realmId) {
    const where = encodeURIComponent('Type=="ACCREC"');
    const inv = (await call(env, store, realmId, 'GET', `/Invoices?where=${where}&Statuses=AUTHORISED,SUBMITTED&order=DueDate`)).Invoices || [];
    const today = Date.now();
    return inv.filter(i => Number(i.AmountDue) > 0).map(i => ({
      id: i.InvoiceID, number: i.InvoiceNumber || '', customer: (i.Contact || {}).Name || 'Customer', date: day(i.DateString), due: day(i.DueDateString) || day(i.DateString),
      total: Number(i.Total), balance: Number(i.AmountDue), email: (i.Contact || {}).EmailAddress || '', cis: 0,
      daysOverdue: Math.max(0, Math.floor((today - Date.parse(day(i.DueDateString) || day(i.DateString))) / 86400000)),
    })).sort((a, b) => b.daysOverdue - a.daysOverdue);
  }

  // Xero's profit and loss report is rows inside sections; read the totals by their labels.
  function reportTotals(rep) {
    const out = {};
    const walk = (rows) => (rows || []).forEach(r => { const c = r.Cells || []; if (c[0] && c[1] && (r.RowType === 'Row' || r.RowType === 'SummaryRow')) out[String(c[0].Value).toLowerCase()] = Number(String(c[1].Value).replace(/[^0-9.-]/g, '')) || 0; walk(r.Rows); });
    walk(((rep.Reports || [])[0] || {}).Rows);
    return out;
  }
  async function summary(env, store, realmId, month, TAX_POT) {
    const m = /^\d{4}-\d{2}$/.test(month || '') ? month : D.ukToday().slice(0, 7);
    const [y, mo] = m.split('-').map(Number), end = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
    const cl = (await D.getClient(store, realmId)) || {};
    const rep = await call(env, store, realmId, 'GET', `/Reports/ProfitAndLoss?fromDate=${m}-01&toDate=${end}&standardLayout=true${cl.basis === 'accrual' ? '' : '&paymentsOnly=true'}`);
    const x = reportTotals(rep);
    const moneyIn = round2(x['total income'] != null ? x['total income'] : x['total trading income']);
    const moneyOut = round2((x['total cost of sales'] || 0) + (x['total operating expenses'] || 0) + (x['total other expenses'] || 0));
    const profit = round2(x['net profit'] != null ? x['net profit'] : moneyIn - moneyOut);
    const inv = await owed(env, store, realmId);
    return { month: m, moneyIn, moneyOut, profit, owed: round2(inv.reduce((s, i) => s + i.balance, 0)), owedCount: inv.length, taxPot: round2(Math.max(0, profit) * TAX_POT) };
  }

  const spend = async (env, store, realmId, fromIso) => ((await call(env, store, realmId, 'GET', `/BankTransactions?where=${encodeURIComponent(`Type=="SPEND" AND Date>=${dt(fromIso)}`)}&order=Date DESC`)).BankTransactions || []).filter(b => b.Status !== 'DELETED');
  async function recent(env, store, realmId) {
    const list = (await spend(env, store, realmId, new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10))).slice(0, 10);
    return list.map(b => ({ id: b.BankTransactionID, date: day(b.DateString), total: Number(b.Total), supplier: (b.Contact || {}).Name || '', jobId: '', job: '' }));
  }
  // Monthly books-check inputs: spending with no receipt attached, and spending sitting in a catch-all account.
  async function noReceipt(env, store, realmId) {
    const list = await spend(env, store, realmId, new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10));
    const names = Object.fromEntries((await accounts(env, store, realmId)).map(a => [a.Code, a.Name]));
    return list.filter(b => !b.HasAttachments && Number(b.Total) > 0).map(b => ({ id: b.BankTransactionID, date: day(b.DateString), supplier: (b.Contact || {}).Name || '', total: Number(b.Total), account: names[((b.LineItems || [])[0] || {}).AccountCode] || '' }));
  }
  const CATCHALL = /uncategori[sz]ed|suspense|ask my accountant/i;
  async function untidy(env, store, realmId) {
    const list = await spend(env, store, realmId, new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10));
    const names = Object.fromEntries((await accounts(env, store, realmId)).map(a => [a.Code, a.Name]));
    return list.filter(b => (b.LineItems || []).some(l => CATCHALL.test(names[l.AccountCode] || ''))).map(b => ({ id: b.BankTransactionID, date: day(b.DateString), amount: Number(b.Total), supplier: (b.Contact || {}).Name || '', note: ((b.LineItems || [])[0] || {}).Description || '' }));
  }
  async function tidy(env, store, realmId, id, category) {
    const b = ((await call(env, store, realmId, 'GET', `/BankTransactions/${id}`)).BankTransactions || [])[0];
    if (!b) throw new Error('That expense is not in Xero any more');
    const all = await accounts(env, store, realmId), names = Object.fromEntries(all.map(a => [a.Code, a.Name]));
    const target = pickAccount(expenseAccounts(all), category);
    if (!target) throw new Error('No expense accounts found in Xero');
    const lines = (b.LineItems || []).map(l => (CATCHALL.test(names[l.AccountCode] || '') ? { ...l, AccountCode: target.Code } : l));
    await call(env, store, realmId, 'POST', `/BankTransactions/${id}`, { BankTransactionID: id, LineItems: lines });
    await D.logChange(store, realmId, { kind: 'tidy', ref: id, text: `Moved ${(b.Contact || {}).Name || 'an expense'} to ${target.Name}` });
    return { ok: true, account: target.Name };
  }

  async function contactId(env, store, realmId, name, email) {
    const found = ((await call(env, store, realmId, 'GET', `/Contacts?where=${encodeURIComponent(`Name=="${q(name)}"`)}`)).Contacts || []).find(c => c.ContactStatus !== 'ARCHIVED');
    if (found) return found.ContactID;
    return ((await call(env, store, realmId, 'PUT', '/Contacts', { Name: name, ...(email ? { EmailAddress: email } : {}) })).Contacts || [])[0].ContactID;
  }
  async function newInvoice(env, store, realmId, r, sendAllowed) {
    const t = await token(env, store, realmId);
    const amount = r.cis ? round2((Number(r.labour) || 0) + (Number(r.materials) || 0)) : round2(r.amount);
    if (!(amount > 0)) throw new Error('Put in an amount');
    const name = (r.customer || '').trim().slice(0, 100);
    if (!name) throw new Error('Put in the customer\'s name');
    const email = (r.email || '').trim();
    const cid = await contactId(env, store, realmId, name, email);
    const reg = await registered(store, realmId, t);
    const kinds = { standard: 20, reduced: 5, zero: 0, none: 0 };
    const rate = reg ? (kinds[r.vatRate] != null ? kinds[r.vatRate] : r.vat ? 20 : 0) : 0;
    const taxType = !reg ? 'NONE' : rate === 20 ? 'OUTPUT2' : rate === 5 ? 'RROUTPUT' : 'ZERORATEDOUTPUT';
    const line = (d, a) => ({ Description: String(d).slice(0, 250), Quantity: 1, UnitAmount: a, AccountCode: '200', TaxType: taxType });
    const items = r.cis
      ? [line(`${r.description || 'Labour'} (labour)`, round2(r.labour)), ...(round2(r.materials) > 0 ? [line('Materials', round2(r.materials))] : [])]
      : [line(r.description || 'Work done', amount)];
    const cisDeduction = r.cis ? round2((Number(r.labour) || 0) * 0.2) : 0;
    const due = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const inv = ((await call(env, store, realmId, 'PUT', '/Invoices', { Type: 'ACCREC', Contact: { ContactID: cid }, Date: D.ukToday(), DueDate: due, LineAmountTypes: 'Exclusive', Status: 'AUTHORISED', LineItems: items, ...(r.cis ? { Reference: `CIS job: ${D.money(cisDeduction)} deducted at source` } : {}) })).Invoices || [])[0];
    if (!inv) throw new Error('Xero did not create the invoice');
    let sentTo = '';
    if (email && sendAllowed) { await call(env, store, realmId, 'POST', `/Invoices/${inv.InvoiceID}/Email`, {}); sentTo = email; }
    const total = Number(inv.Total) || round2(amount * (1 + rate / 100));
    await D.logChange(store, realmId, { kind: 'invoice', ref: inv.InvoiceID, text: `Invoice ${inv.InvoiceNumber || ''} for ${r.customer} ${D.money(total)}${sentTo ? `, emailed to ${sentTo}` : ''}`.trim() });
    return { ok: true, id: inv.InvoiceID, number: inv.InvoiceNumber || '', total, sentTo, cisDeduction, toReceive: round2(total - cisDeduction) };
  }

  async function status(env, store, realmId) {
    const t = await saved(store, realmId);
    try {
      const o = ((await call(env, store, realmId, 'GET', '/Organisation')).Organisations || [])[0] || {};
      return { connected: true, company: o.Name, sandbox: Boolean(o.IsDemoCompany) || (t && t.env) !== 'production', since: t && t.saved_at, software: SOFTWARE };
    } catch (err) { return { connected: false, problem: String(err.message).slice(0, 120), software: SOFTWARE }; }
  }

  // Read-write check of a new connection that cleans up after itself: every entry is named TEST and removed at the end.
  async function selftest(env, store, realmId) {
    const steps = [], step = async (name, fn) => { try { const note = await fn(); steps.push({ name, ok: true, note: note || '' }); return true; } catch (e) { steps.push({ name, ok: false, note: String(e.message).slice(0, 160) }); return false; } };
    const made = { expense: null, invoice: null };
    const TEST = 'TEST Books connection (delete me)';
    try {
      await step('Connected to Xero', async () => { const s = await status(env, store, realmId); if (!s.connected) throw new Error(s.problem); return s.sandbox ? 'demo company' : 'live'; });
      await step('Reads expense accounts', async () => { const c = await categories(env, store, realmId); if (!c.length) throw new Error('none found'); return `${c.length} found`; });
      await step('Reads figures and who owes you', async () => { await summary(env, store, realmId, null, 0.25); await recent(env, store, realmId); await noReceipt(env, store, realmId); return 'ok'; });
      await step('Files a test receipt', async () => {
        const r = await fileReceipt(env, store, realmId, { supplier: TEST, total: 1.2, vat: 0.2, category: 'Fuel', items: 'connection test', image: 'data:image/png;base64,iVBORw0KGgo=' });
        if (!r.ok || r.duplicate) throw new Error('not created'); made.expense = r.id; return `${r.account}, VAT ${r.vatCode}${r.attached ? ', receipt attached' : ''}`;
      });
      await step('Test receipt can be found', async () => { const l = await recent(env, store, realmId); if (!l.some(x => x.id === made.expense)) throw new Error('not in the list'); });
      await step('Undo removes the test receipt', async () => { await undo(env, store, realmId, made.expense); made.expense = null; });
      await step('Creates a test invoice that counts as owed', async () => {
        const r = await newInvoice(env, store, realmId, { customer: TEST, description: 'connection test', amount: 1 }, false);
        made.invoice = r.id;
        const o = await owed(env, store, realmId); if (!o.some(i => i.id === String(r.id))) throw new Error('not in who-owes-you');
        return `total ${r.total}`;
      });
    } finally {
      await step('Cleans up the test invoice', async () => { if (!made.invoice) return 'none made'; await call(env, store, realmId, 'POST', `/Invoices/${made.invoice}`, { InvoiceID: made.invoice, Status: 'VOIDED' }); });
      await step('Cleans up the test customer', async () => { const c = ((await call(env, store, realmId, 'GET', `/Contacts?where=${encodeURIComponent(`Name=="${TEST}"`)}`)).Contacts || []); for (const x of c) await call(env, store, realmId, 'POST', `/Contacts/${x.ContactID}`, { ContactID: x.ContactID, ContactStatus: 'ARCHIVED' }); return c.length ? 'archived' : 'none'; });
      await step('Cleans up any leftover test receipt', async () => { if (made.expense) await call(env, store, realmId, 'POST', `/BankTransactions/${made.expense}`, { BankTransactionID: made.expense, Status: 'DELETED' }); });
    }
    return { ok: steps.every(s => s.ok), steps };
  }

  return { call, token, selftest, fileReceipt, undo, owed, summary, recent, newInvoice, status, categories, registered, untidy, tidy, noReceipt };
}
