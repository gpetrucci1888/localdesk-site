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
