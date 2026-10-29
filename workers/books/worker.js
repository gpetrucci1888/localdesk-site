// QuickBooks connector.
//
// Holds each client's QuickBooks connection and keeps it alive, so checks and
// receipt uploads can talk to QuickBooks without anyone logging in again.
//
//   GET  /connect?k=ADMIN_KEY   send the client to Intuit to click "Allow"
//   GET  /callback              Intuit sends them back here; tokens are saved
//   GET  /companies             (X-Key header) which QuickBooks companies are connected
//   ANY  /qb/<realmId>/<path>   (X-Key header) passed through to the QuickBooks API,
//                               e.g. /qb/123/query?query=select * from Purchase
//   POST /file/<realmId>        (X-Key header) files one receipt as an expense with its photo:
//                               {image, supplier, date, total, vat, category, items}
//   GET  /summary/<realmId>     (X-Key) this month: money in, money out, profit, owed, rough tax pot
//   GET  /owed/<realmId>        (X-Key) unpaid invoices, most overdue first
//   POST /remind/<realmId>/<id> (X-Key) emails that invoice to the customer again
//   POST /invoice/<realmId>     (X-Key) {customer, email, description, amount, vat} new invoice, emailed if there's an address
//   GET  /recent/<realmId>      (X-Key) the last few expenses
//
// Settings: QB_CLIENT_ID, QB_CLIENT_SECRET (from the Intuit app), ADMIN_KEY,
// QB_ENV ("sandbox" or "production"). Tokens live in the Store Durable Object.

const AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const SCOPE = 'com.intuit.quickbooks.accounting';
const MINOR_VERSION = '75';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const store = env.STORE.get(env.STORE.idFromName('main'));
    const redirectUri = `${url.origin}/callback`;
    try {
      if (url.pathname === '/connect') {
        if (url.searchParams.get('k') !== env.ADMIN_KEY) return text('Not allowed', 403);
        const state = crypto.randomUUID();
        await store.fetch('https://store/state', { method: 'PUT', body: state });
        const go = new URL(AUTH_URL);
        go.search = new URLSearchParams({ client_id: env.QB_CLIENT_ID, response_type: 'code', scope: SCOPE, redirect_uri: redirectUri, state }).toString();
        return Response.redirect(go.toString(), 302);
      }

      if (url.pathname === '/callback') {
        const ok = await store.fetch('https://store/state', { method: 'POST', body: url.searchParams.get('state') || '' });
        if (!ok.ok) return page('That link has expired. Ask Gio for a fresh one.');
        const code = url.searchParams.get('code'), realmId = url.searchParams.get('realmId');
        if (!code || !realmId) return page('QuickBooks didn\'t connect. Nothing was changed.');
        const tokens = await tokenRequest(env, { grant_type: 'authorization_code', code, redirect_uri: redirectUri });
        await store.fetch(`https://store/tokens/${realmId}`, { method: 'PUT', body: JSON.stringify(tokens) });
        return page('Connected ✓ You can close this page.');
      }

      if (request.headers.get('X-Key') !== env.ADMIN_KEY || !env.ADMIN_KEY) return text('Not allowed', 403);

      if (url.pathname === '/companies') return store.fetch('https://store/tokens');

      const f = url.pathname.match(/^\/file\/(\d+)$/);
      if (f && request.method === 'POST') return Response.json(await fileReceipt(env, store, f[1], await request.json()));

      const a = url.pathname.match(/^\/(summary|owed|recent|invoice|remind)\/(\d+)(?:\/(\d+))?$/);
      if (a) {
        const [, what, realmId, id] = a;
        if (what === 'summary') return Response.json(await summary(env, store, realmId, url.searchParams.get('month')));
        if (what === 'owed') return Response.json(await owed(env, store, realmId));
        if (what === 'recent') return Response.json(await recent(env, store, realmId));
        if (what === 'invoice' && request.method === 'POST') return Response.json(await newInvoice(env, store, realmId, await request.json()));
        if (what === 'remind' && request.method === 'POST' && id) return Response.json(await remind(env, store, realmId, id));
      }

      const m = url.pathname.match(/^\/qb\/(\d+)\/(.+)$/);
      if (m) {
        const [, realmId, path] = m;
        const access = await accessToken(env, store, realmId);
        const base = env.QB_ENV === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com';
        const target = new URL(`${base}/v3/company/${realmId}/${path}`);
        url.searchParams.forEach((v, k) => target.searchParams.set(k, v));
        target.searchParams.set('minorversion', MINOR_VERSION);
        const headers = { Authorization: `Bearer ${access}`, Accept: 'application/json' };
        if (request.headers.get('Content-Type')) headers['Content-Type'] = request.headers.get('Content-Type');
        const res = await fetch(target, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body });
        return new Response(res.body, { status: res.status, headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' } });
      }

      return text('Not found', 404);
    } catch (err) {
      return text(`Error: ${err && err.message || err}`, 500);
    }
  },
};

// ---------- filing a receipt ----------

// Which QuickBooks account each receipt category goes to: the first account whose name
// matches, exactly or in part, in this order. Anything unmatched goes to Uncategorised.
const ACCOUNT_NAMES = {
  'Materials': ['cost of sales', 'materials', 'purchases'],
  'Tools and equipment': ['tools', 'equipment', 'repair and maintenance'],
  'Fuel': ['motor', 'vehicle', 'fuel', 'travel'],
  'Vehicle': ['motor', 'vehicle', 'travel'],
  'Subcontractors': ['subcontract'],
  'Phone and internet': ['telephone', 'internet'],
  'Office': ['office'],
  'Food and drink': ['meals', 'subsistence', 'entertainment'],
  'Other': [],
};

async function fileReceipt(env, store, realmId, r) {
  const q = (sql) => qb(env, store, realmId, 'GET', 'query?query=' + encodeURIComponent(sql)).then(d => d.QueryResponse || {});
  const total = round(r.total), vat = round(r.vat);
  if (!(total > 0)) throw new Error('No total on the receipt');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : new Date().toISOString().slice(0, 10);

  const vendorId = await findOrCreateVendor(env, store, realmId, q, (r.supplier || 'Unknown supplier').trim().slice(0, 100));

  // Same supplier, date and total already in QuickBooks: don't file it twice.
  const same = (await q(`select Id, EntityRef from Purchase where TxnDate = '${date}' and TotalAmt = '${total}'`)).Purchase || [];
  const dup = same.find(p => p.EntityRef && p.EntityRef.value === vendorId);
  if (dup) return { ok: true, duplicate: true, id: dup.Id };

  const accounts = (await q("select Id, Name, AccountType, Active from Account maxresults 1000")).Account || [];
  const bank = accounts.find(a => a.AccountType === 'Bank');
  if (!bank) throw new Error('No bank account in QuickBooks to pay from');
  const expense = pickAccount(accounts.filter(a => a.AccountType === 'Expense' || a.AccountType === 'Cost of Goods Sold'), r.category);

  const codes = (await q('select Id, Name, Active from TaxCode')).TaxCode || [];
  const net = round(total - vat);
  const rate = net > 0 ? vat / net : 0;
  const codeName = vat <= 0 ? 'No VAT' : Math.abs(rate - 0.05) < 0.01 ? '5.0% R' : '20.0% S';
  const code = codes.find(c => c.Name === codeName);

  const purchase = {
    PaymentType: 'Cash',
    AccountRef: { value: bank.Id },
    EntityRef: { value: vendorId, type: 'Vendor' },
    TxnDate: date,
    PrivateNote: `${r.items || ''} (added from a receipt photo)`.trim().slice(0, 4000),
    GlobalTaxCalculation: code ? 'TaxExcluded' : 'NotApplicable',
    Line: [{
      Amount: code ? net : total,
      DetailType: 'AccountBasedExpenseLineDetail',
      Description: (r.items || r.category || '').slice(0, 4000),
      AccountBasedExpenseLineDetail: { AccountRef: { value: expense.Id }, ...(code ? { TaxCodeRef: { value: code.Id } } : {}) },
    }],
  };
  const created = (await qb(env, store, realmId, 'POST', 'purchase', purchase)).Purchase;

  let attached = false;
  const img = (r.image || '').match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (img) {
    const bytes = Uint8Array.from(atob(img[2]), c => c.charCodeAt(0));
    const form = new FormData();
    form.append('file_metadata_01', new Blob([JSON.stringify({ AttachableRef: [{ EntityRef: { type: 'Purchase', value: created.Id } }], FileName: 'receipt.jpg', ContentType: img[1] })], { type: 'application/json' }), 'meta.json');
    form.append('file_content_01', new Blob([bytes], { type: img[1] }), 'receipt.jpg');
    await qb(env, store, realmId, 'POST', 'upload', form);
    attached = true;
  }
  return { ok: true, id: created.Id, total: created.TotalAmt, account: expense.Name, vatCode: code ? code.Name : 'none', attached };
}

async function findOrCreateVendor(env, store, realmId, q, name) {
  const safe = name.replace(/'/g, "\\'");
  const found = (await q(`select Id from Vendor where DisplayName = '${safe}'`)).Vendor || [];
  if (found.length) return found[0].Id;
  return (await qb(env, store, realmId, 'POST', 'vendor', { DisplayName: name })).Vendor.Id;
}

function pickAccount(accounts, category) {
  const want = ACCOUNT_NAMES[category] || [];
  const named = (n) => accounts.filter(a => a.Active !== false && a.Name.toLowerCase() === n)[0]
    || accounts.filter(a => a.Active !== false && a.Name.toLowerCase().includes(n))[0];
  for (const n of want) { const a = named(n); if (a) return a; }
  return named('uncategorised') || named('uncategorized') || accounts[0];
}

// ---------- money in, money out, who owes ----------

const query = (env, store, realmId, sql) => qb(env, store, realmId, 'GET', 'query?query=' + encodeURIComponent(sql)).then(d => d.QueryResponse || {});

// Rough tax guide: about a quarter of profit (basic-rate income tax plus Class 4 NI). Shown as a guide only.
const TAX_POT = 0.25;

async function summary(env, store, realmId, month) {
  const m = /^\d{4}-\d{2}$/.test(month || '') ? month : new Date().toISOString().slice(0, 7);
  const [y, mo] = m.split('-').map(Number);
  const end = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
  const report = await qb(env, store, realmId, 'GET', `reports/ProfitAndLoss?start_date=${m}-01&end_date=${end}`);
  const totals = {};
  for (const row of (report.Rows && report.Rows.Row) || []) {
    const cols = row.Summary && row.Summary.ColData;
    if (row.group && cols) totals[row.group] = Number(cols[cols.length - 1].value) || 0;
  }
  const moneyIn = round(totals.Income || 0);
  const moneyOut = round((totals.COGS || 0) + (totals.Expenses || 0) + (totals.OtherExpenses || 0));
  const profit = round(totals.NetIncome != null ? totals.NetIncome : moneyIn - moneyOut);
  const inv = await owed(env, store, realmId);
  return { month: m, moneyIn, moneyOut, profit, owed: round(inv.reduce((s, i) => s + i.balance, 0)), owedCount: inv.length, taxPot: round(Math.max(0, profit) * TAX_POT) };
}

async function owed(env, store, realmId) {
  const list = (await query(env, store, realmId, "select Id, DocNumber, CustomerRef, TxnDate, DueDate, TotalAmt, Balance, BillEmail from Invoice where Balance > '0' maxresults 200")).Invoice || [];
  const today = Date.now();
  return list.map(i => ({
    id: i.Id, number: i.DocNumber || '', customer: (i.CustomerRef && i.CustomerRef.name) || 'Customer',
    date: i.TxnDate, due: i.DueDate || i.TxnDate, total: Number(i.TotalAmt), balance: Number(i.Balance),
    email: (i.BillEmail && i.BillEmail.Address) || '',
    daysOverdue: Math.max(0, Math.floor((today - Date.parse(i.DueDate || i.TxnDate)) / 86400000)),
  })).sort((a, b) => b.daysOverdue - a.daysOverdue);
}

async function remind(env, store, realmId, id) {
  const inv = (await qb(env, store, realmId, 'GET', `invoice/${id}`)).Invoice;
  const email = inv.BillEmail && inv.BillEmail.Address;
  if (!email) throw new Error('No email address for this customer. Add one in QuickBooks first');
  await qb(env, store, realmId, 'POST', `invoice/${id}/send?sendTo=${encodeURIComponent(email)}`);
  return { ok: true, sentTo: email };
}

async function newInvoice(env, store, realmId, r) {
  const amount = round(r.amount);
  if (!(amount > 0)) throw new Error('Put in an amount');
  const name = (r.customer || '').trim().slice(0, 100);
  if (!name) throw new Error('Put in the customer\'s name');
  const email = (r.email || '').trim();
  const safe = name.replace(/'/g, "\\'");
  let cust = ((await query(env, store, realmId, `select Id, PrimaryEmailAddr from Customer where DisplayName = '${safe}'`)).Customer || [])[0];
  if (!cust) cust = (await qb(env, store, realmId, 'POST', 'customer', { DisplayName: name, ...(email ? { PrimaryEmailAddr: { Address: email } } : {}) })).Customer;
  const items = (await query(env, store, realmId, "select Id, Name from Item where Type = 'Service' and Active = true maxresults 50")).Item || [];
  const item = items.find(i => /^(services?|labour)$/i.test(i.Name)) || items[0];
  if (!item) throw new Error('No service item in QuickBooks to invoice for');
  const codes = (await query(env, store, realmId, 'select Id, Name from TaxCode')).TaxCode || [];
  const code = codes.find(c => c.Name === (r.vat ? '20.0% S' : 'No VAT'));
  const invoice = {
    CustomerRef: { value: cust.Id },
    ...(email ? { BillEmail: { Address: email } } : {}),
    GlobalTaxCalculation: code ? 'TaxExcluded' : 'NotApplicable',
    Line: [{
      Amount: amount, DetailType: 'SalesItemLineDetail', Description: (r.description || '').slice(0, 4000),
      SalesItemLineDetail: { ItemRef: { value: item.Id }, Qty: 1, UnitPrice: amount, ...(code ? { TaxCodeRef: { value: code.Id } } : {}) },
    }],
  };
  const created = (await qb(env, store, realmId, 'POST', 'invoice', invoice)).Invoice;
  let sentTo = '';
  if (email) { await qb(env, store, realmId, 'POST', `invoice/${created.Id}/send?sendTo=${encodeURIComponent(email)}`); sentTo = email; }
  return { ok: true, id: created.Id, number: created.DocNumber, total: Number(created.TotalAmt), sentTo };
}

async function recent(env, store, realmId) {
  const list = (await query(env, store, realmId, 'select Id, TxnDate, TotalAmt, EntityRef from Purchase orderby MetaData.CreateTime desc maxresults 10')).Purchase || [];
  return list.map(p => ({ id: p.Id, date: p.TxnDate, total: Number(p.TotalAmt), supplier: (p.EntityRef && p.EntityRef.name) || '' }));
}

function round(n) { return Math.round((Number(n) || 0) * 100) / 100; }

// One QuickBooks API call. Body may be JSON-able or FormData.
async function qb(env, store, realmId, method, path, body) {
  const access = await accessToken(env, store, realmId);
  const base = env.QB_ENV === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com';
  const sep = path.includes('?') ? '&' : '?';
  const headers = { Authorization: `Bearer ${access}`, Accept: 'application/json' };
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}/v3/company/${realmId}/${path}${sep}minorversion=${MINOR_VERSION}`, {
    method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.Fault) {
    const e = data.Fault && data.Fault.Error && data.Fault.Error[0];
    throw new Error(`QuickBooks ${res.status}: ${e ? `${e.Message} ${e.Detail || ''}` : 'request failed'}`.trim());
  }
  return data;
}

// A fresh access token for this company, refreshing (and saving the new refresh token) when needed.
async function accessToken(env, store, realmId) {
  const res = await store.fetch(`https://store/tokens/${realmId}`);
  if (!res.ok) throw new Error(`QuickBooks company ${realmId} isn't connected`);
  const t = await res.json();
  if (t.expires_at - Date.now() > 60_000) return t.access_token;
  const fresh = await tokenRequest(env, { grant_type: 'refresh_token', refresh_token: t.refresh_token });
  await store.fetch(`https://store/tokens/${realmId}`, { method: 'PUT', body: JSON.stringify(fresh) });
  return fresh.access_token;
}

async function tokenRequest(env, params) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${env.QB_CLIENT_ID}:${env.QB_CLIENT_SECRET}`),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Intuit said ${res.status}: ${body.error || ''} ${body.error_description || ''}`.trim());
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: Date.now() + body.expires_in * 1000,
    refresh_expires_at: Date.now() + body.x_refresh_token_expires_in * 1000,
    saved_at: new Date().toISOString(),
  };
}

// One instance holds every client's tokens, so refreshes never race each other.
export class Store {
  constructor(state) { this.storage = state.storage; }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/state') {
      if (request.method === 'PUT') { await this.storage.put('state', { value: await request.text(), at: Date.now() }); return text('ok'); }
      const saved = await this.storage.get('state');
      await this.storage.delete('state');
      const fresh = saved && saved.value === await request.text() && Date.now() - saved.at < 15 * 60_000;
      return text(fresh ? 'ok' : 'expired', fresh ? 200 : 400);
    }
    const m = url.pathname.match(/^\/tokens(?:\/(\d+))?$/);
    if (!m) return text('Not found', 404);
    if (!m[1]) {
      const all = await this.storage.list({ prefix: 'tokens:' });
      return Response.json([...all].map(([k, t]) => ({ realmId: k.slice(7), connected_at: t.saved_at, refresh_expires_at: new Date(t.refresh_expires_at).toISOString() })));
    }
    const key = `tokens:${m[1]}`;
    if (request.method === 'PUT') { await this.storage.put(key, JSON.parse(await request.text())); return text('ok'); }
    const t = await this.storage.get(key);
    return t ? Response.json(t) : text('Not connected', 404);
  }
}

function text(body, status = 200) { return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
function page(msg) {
  return new Response(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>QuickBooks</title><body style="font:18px system-ui;display:grid;place-items:center;min-height:90vh;margin:0;padding:16px;text-align:center"><p>${msg}</p></body>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
