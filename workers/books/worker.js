// QuickBooks connector.
//
// Holds each client's QuickBooks connection and keeps it alive, so checks and
// receipt uploads can talk to QuickBooks without anyone logging in again.
//
//   POST /invite                (X-Key) {name, phone, env, brand} one-off connect link for a new client (14 days)
//   GET  /connect?invite=<id>   the client clicks this, then "Allow" at Intuit
//   GET  /connect?k=ADMIN_KEY   quick connect for Gio (sandbox, for testing)
//   GET  /callback              Intuit sends them back here; tokens saved, client's app link shown
//   GET  /disconnect            landing page after a client disconnects in QuickBooks
//   POST /revoke/<realmId>      (X-Key) cut a client off: revoke at Intuit, delete tokens
//   GET  /app/<appKey>          (X-Key) which company an app link belongs to
//   GET  /companies             (X-Key header) which QuickBooks companies are connected
//   ANY  /qb/<realmId>/<path>   (X-Key header) passed through to the QuickBooks API,
//                               e.g. /qb/123/query?query=select * from Purchase
//   POST /file/<realmId>        (X-Key header) files one receipt as an expense with its photo:
//                               {image, supplier, date, total, vat, category, items}
//   GET  /summary/<realmId>     (X-Key) this month: money in, money out, profit, owed, rough tax pot
//   GET  /owed/<realmId>        (X-Key) unpaid invoices, most overdue first
//   POST /remind/<realmId>/<id> (X-Key) emails that invoice to the customer again
//   POST /paid/<realmId>/<id>   (X-Key) {method: cash|bank|card} records the invoice as paid in full
//   POST /undo/<realmId>/<id>   (X-Key) deletes an expense the app has just filed (the Undo button)
//   POST /invoice/<realmId>     (X-Key) {customer, email, description, amount, vat} new invoice, emailed if there's an address
//   GET  /recent/<realmId>      (X-Key) the last few expenses
//   POST /parse/<realmId>       (X-Key) {text} "40 quid diesel at Shell" -> receipt fields to check and file
//   GET  /untidy/<realmId>      (X-Key) expenses sitting in Uncategorised, each with a suggested category
//   POST /tidy/<realmId>/<id>   (X-Key) {category} moves that expense to the right account
//   GET  /quarter/<realmId>     (X-Key) the Making Tax Digital quarter so far, by category, for the accountant
//   GET  /monthly/<realmId>     (X-Key) preview of the monthly text; POST sends it (?to= to send elsewhere)
//   PUT  /client/<realmId>      (X-Key) {name, phone, brand} changes only the fields given
//
// Once a month (cron) every client with a phone gets their monthly text, and OWNER_PHONE gets a
// short check report. Texts need TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN; SMS_FROM is the sender name.
//
// Settings: QB_CLIENT_ID, QB_CLIENT_SECRET (Intuit development keys, used for sandbox companies),
// QB_PROD_CLIENT_ID, QB_PROD_CLIENT_SECRET (production keys, for real clients), ADMIN_KEY,
// APP_URL (where the phone app lives). Each saved connection remembers which keys it used.
// Tokens, invites and clients live in the Store Durable Object.

const AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const SCOPE = 'com.intuit.quickbooks.accounting';
const MINOR_VERSION = '75';
const REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';

// Development keys only work with sandbox companies; real QuickBooks needs production keys.
function creds(env, which) {
  return which === 'production'
    ? { id: env.QB_PROD_CLIENT_ID, secret: env.QB_PROD_CLIENT_SECRET }
    : { id: env.QB_CLIENT_ID, secret: env.QB_CLIENT_SECRET };
}
const randomKey = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12)))).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const store = env.STORE.get(env.STORE.idFromName('main'));
    const redirectUri = `${url.origin}/callback`;
    try {
      if (url.pathname === '/connect') {
        let invite = null;
        if (url.searchParams.get('invite')) {
          const res = await store.fetch(`https://store/invites/${encodeURIComponent(url.searchParams.get('invite'))}`);
          if (!res.ok) return page('This link has expired or already been used. Ask Gio for a fresh one.');
          invite = await res.json();
        } else if (url.searchParams.get('k') !== env.ADMIN_KEY) {
          return text('Not allowed', 403);
        }
        const which = invite ? invite.env : 'sandbox';
        const state = crypto.randomUUID();
        await store.fetch('https://store/state', { method: 'PUT', body: JSON.stringify({ value: state, invite: invite && invite.id, env: which }) });
        const go = new URL(AUTH_URL);
        go.search = new URLSearchParams({ client_id: creds(env, which).id, response_type: 'code', scope: SCOPE, redirect_uri: redirectUri, state }).toString();
        return Response.redirect(go.toString(), 302);
      }

      if (url.pathname === '/callback') {
        const ok = await store.fetch('https://store/state', { method: 'POST', body: url.searchParams.get('state') || '' });
        if (!ok.ok) return page('That link has expired. Ask Gio for a fresh one.');
        const st = await ok.json();
        const code = url.searchParams.get('code'), realmId = url.searchParams.get('realmId');
        if (!code || !realmId) return page('QuickBooks didn\'t connect. Nothing was changed.');
        const tokens = await tokenRequest(env, st.env, { grant_type: 'authorization_code', code, redirect_uri: redirectUri });
        await store.fetch(`https://store/tokens/${realmId}`, { method: 'PUT', body: JSON.stringify(tokens) });
        if (!st.invite) return page('Connected ✓ You can close this page.');
        const inv = await (await store.fetch(`https://store/invites/${encodeURIComponent(st.invite)}`)).json().catch(() => ({}));
        const existing = await getClient(store, realmId);
        const client = { name: inv.name || '', phone: inv.phone || '', brand: inv.brand || (existing && existing.brand) || '', appKey: (existing && existing.appKey) || randomKey(), env: st.env, connected_at: new Date().toISOString() };
        await store.fetch(`https://store/clients/${realmId}`, { method: 'PUT', body: JSON.stringify(client) });
        await store.fetch(`https://store/invites/${encodeURIComponent(st.invite)}`, { method: 'DELETE' });
        const app = `${env.APP_URL}/${client.appKey}/`;
        if (env.OWNER_PHONE && env.TWILIO_ACCOUNT_SID) await sendSms(env, env.OWNER_PHONE, `Books: ${client.name || realmId} just connected their QuickBooks. Their app: ${app}`).catch(() => {});
        return page(`Connected ✓<br><br>Your Books app:<br><a href="${app}" style="font-weight:800;word-break:break-all">${app}</a><br><br><small>Open it on your phone, then "Add to Home Screen".</small>`);
      }

      if (url.pathname === '/disconnect') {
        return page('Books is disconnected from your QuickBooks.<br><br>We no longer read or change anything in your books. Anything already filed stays in QuickBooks.<br><br><small>Questions: hello@localdeskai.co.uk</small>');
      }

      if (request.headers.get('X-Key') !== env.ADMIN_KEY || !env.ADMIN_KEY) return text('Not allowed', 403);

      if (url.pathname === '/companies') return store.fetch('https://store/tokens');

      if (url.pathname === '/invite' && request.method === 'POST') {
        const r = await request.json();
        const which = r.env === 'sandbox' ? 'sandbox' : 'production';
        if (!creds(env, which).id) throw new Error(`No ${which} keys set up yet`);
        const inv = { id: randomKey(), name: String(r.name || '').slice(0, 100), phone: String(r.phone || ''), brand: String(r.brand || ''), env: which, created: Date.now() };
        await store.fetch(`https://store/invites/${inv.id}`, { method: 'PUT', body: JSON.stringify(inv) });
        return Response.json({ ok: true, link: `${url.origin}/connect?invite=${inv.id}`, expires: new Date(inv.created + INVITE_DAYS * 86400000).toISOString() });
      }

      const ak = url.pathname.match(/^\/app\/([\w-]+)$/);
      if (ak) {
        const res = await store.fetch(`https://store/appkeys/${ak[1]}`);
        return res.ok ? res : Response.json({ error: 'Unknown app link' }, { status: 404 });
      }

      const rv = url.pathname.match(/^\/revoke\/(\d+)$/);
      if (rv && request.method === 'POST') {
        const t = await (await store.fetch(`https://store/tokens/${rv[1]}`)).json().catch(() => null);
        if (t) {
          const c = creds(env, t.env);
          await fetch(REVOKE_URL, { method: 'POST', headers: { Authorization: 'Basic ' + btoa(`${c.id}:${c.secret}`), 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ token: t.refresh_token }) });
        }
        await store.fetch(`https://store/tokens/${rv[1]}`, { method: 'DELETE' });
        await store.fetch(`https://store/clients/${rv[1]}`, { method: 'DELETE' });
        return Response.json({ ok: true });
      }

      const f = url.pathname.match(/^\/file\/(\d+)$/);
      if (f && request.method === 'POST') return Response.json(await fileReceipt(env, store, f[1], await request.json()));

      const a = url.pathname.match(/^\/(summary|owed|recent|invoice|remind|paid|undo|parse|untidy|tidy|quarter|monthly|client)\/(\d+)(?:\/(\d+))?$/);
      if (a) {
        const [, what, realmId, id] = a;
        if (what === 'summary') return Response.json(await summary(env, store, realmId, url.searchParams.get('month')));
        if (what === 'owed') return Response.json(await owed(env, store, realmId));
        if (what === 'recent') return Response.json(await recent(env, store, realmId));
        if (what === 'invoice' && request.method === 'POST') return Response.json(await newInvoice(env, store, realmId, await request.json()));
        if (what === 'remind' && request.method === 'POST' && id) return Response.json(await remind(env, store, realmId, id));
        if (what === 'paid' && request.method === 'POST' && id) return Response.json(await markPaid(env, store, realmId, id, (await request.json()).method));
        if (what === 'undo' && request.method === 'POST' && id) return Response.json(await undoPurchase(env, store, realmId, id));
        if (what === 'parse' && request.method === 'POST') return Response.json(await parseSpoken(env, (await request.json()).text));
        if (what === 'untidy') return Response.json(await untidy(env, store, realmId));
        if (what === 'tidy' && request.method === 'POST' && id) return Response.json(await tidy(env, store, realmId, id, (await request.json()).category));
        if (what === 'quarter') return Response.json(await quarter(env, store, realmId, url.searchParams.get('date')));
        if (what === 'client' && request.method === 'PUT') {
          const v = await request.json(), old = (await getClient(store, realmId)) || {};
          for (const f of ['name', 'phone', 'brand']) if (typeof v[f] === 'string') old[f] = v[f];
          await store.fetch(`https://store/clients/${realmId}`, { method: 'PUT', body: JSON.stringify(old) });
          return Response.json(old);
        }
        if (what === 'monthly') {
          const msg = await monthlyText(env, store, realmId, url.searchParams.get('month'));
          if (request.method !== 'POST') return Response.json({ text: msg });
          const client = await getClient(store, realmId);
          const to = url.searchParams.get('to') || (client && client.phone);
          if (!to) throw new Error('No phone number saved for this client');
          await sendSms(env, to, msg);
          return Response.json({ ok: true, sentTo: to, text: msg });
        }
      }

      const m = url.pathname.match(/^\/qb\/(\d+)\/(.+)$/);
      if (m) {
        const [, realmId, path] = m;
        const t = await accessToken(env, store, realmId);
        const base = t.env === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com';
        const access = t.access_token;
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

  // 1st of the month: monthly text to each client, check report to Gio.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(monthlyRun(env).catch(err => console.error('monthly run failed', err && err.stack || err)));
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
    PrivateNote: `${r.items || ''} (${r.image ? 'added from a receipt photo' : 'added in Books'})`.trim().slice(0, 4000),
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

const CIS_RATE = 0.2;
const INVITE_DAYS = 14;

// Paid in full by cash, bank transfer or card. Bank and card go straight to the bank account;
// cash goes to QuickBooks' Undeposited Funds until it's banked.
async function markPaid(env, store, realmId, id, method) {
  const inv = (await qb(env, store, realmId, 'GET', `invoice/${id}`)).Invoice;
  const balance = Number(inv.Balance);
  if (!(balance > 0)) return { ok: true, alreadyPaid: true };
  const how = { cash: 'Cash', bank: 'Bank transfer', card: 'Card' }[method] || 'Cash';
  let deposit;
  if (method === 'bank' || method === 'card') {
    const banks = (await query(env, store, realmId, "select Id from Account where AccountType = 'Bank' and Active = true")).Account || [];
    if (banks.length) deposit = { value: banks[0].Id };
  }
  await qb(env, store, realmId, 'POST', 'payment', {
    CustomerRef: inv.CustomerRef, TotalAmt: balance, TxnDate: new Date().toISOString().slice(0, 10),
    PrivateNote: `Paid by ${how.toLowerCase()} (marked in Books)`,
    ...(deposit ? { DepositToAccountRef: deposit } : {}),
    Line: [{ Amount: balance, LinkedTxn: [{ TxnId: inv.Id, TxnType: 'Invoice' }] }],
  });
  return { ok: true, amount: balance, how };
}

// Only expenses this app filed can be undone (they carry our note).
async function undoPurchase(env, store, realmId, id) {
  const p = (await qb(env, store, realmId, 'GET', `purchase/${id}`)).Purchase;
  if (!/added from a receipt photo|added in Books/.test(p.PrivateNote || '')) throw new Error('Only expenses added from the app can be undone here');
  await qb(env, store, realmId, 'POST', 'purchase?operation=delete', { Id: p.Id, SyncToken: p.SyncToken });
  return { ok: true };
}

async function newInvoice(env, store, realmId, r) {
  const amount = r.cis ? round((Number(r.labour) || 0) + (Number(r.materials) || 0)) : round(r.amount);
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
  // CIS job: labour and materials on separate lines; the contractor deducts 20% of the labour only.
  const labour = round(r.labour), materials = round(r.materials);
  const cis = Boolean(r.cis) && labour > 0;
  const line = (amt, desc) => ({
    Amount: amt, DetailType: 'SalesItemLineDetail', Description: desc.slice(0, 4000),
    SalesItemLineDetail: { ItemRef: { value: item.Id }, Qty: 1, UnitPrice: amt, ...(code ? { TaxCodeRef: { value: code.Id } } : {}) },
  });
  const desc = (r.description || '').trim();
  const cisDeduction = cis ? round(labour * CIS_RATE) : 0;
  const invoice = {
    CustomerRef: { value: cust.Id },
    ...(email ? { BillEmail: { Address: email } } : {}),
    GlobalTaxCalculation: code ? 'TaxExcluded' : 'NotApplicable',
    Line: cis
      ? [line(labour, `Labour${desc ? ': ' + desc : ''}`), ...(materials > 0 ? [line(materials, `Materials${desc ? ': ' + desc : ''}`)] : [])]
      : [line(amount, desc)],
    ...(cis ? {
      CustomerMemo: { value: `CIS: labour £${labour.toFixed(2)}, materials £${materials.toFixed(2)}. Deduct 20% of labour only (£${cisDeduction.toFixed(2)}).` },
      PrivateNote: `CIS job. Expected deduction £${cisDeduction.toFixed(2)}.`,
    } : {}),
  };
  const created = (await qb(env, store, realmId, 'POST', 'invoice', invoice)).Invoice;
  let sentTo = '';
  if (email) { await qb(env, store, realmId, 'POST', `invoice/${created.Id}/send?sendTo=${encodeURIComponent(email)}`); sentTo = email; }
  return { ok: true, id: created.Id, number: created.DocNumber, total: Number(created.TotalAmt), sentTo, cisDeduction, toReceive: round(Number(created.TotalAmt) - cisDeduction) };
}

async function recent(env, store, realmId) {
  const list = (await query(env, store, realmId, 'select Id, TxnDate, TotalAmt, EntityRef from Purchase orderby MetaData.CreateTime desc maxresults 10')).Purchase || [];
  return list.map(p => ({ id: p.Id, date: p.TxnDate, total: Number(p.TotalAmt), supplier: (p.EntityRef && p.EntityRef.name) || '' }));
}

// ---------- quick add by voice or typing ----------

const CATEGORIES = Object.keys(ACCOUNT_NAMES);
const TEXT_MODELS = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct'];

async function askJson(env, prompt) {
  let last = '';
  for (const model of TEXT_MODELS) {
    try {
      const out = await env.AI.run(model, { messages: [{ role: 'user', content: prompt }], max_tokens: 600 });
      const t = typeof out.response === 'string' ? out.response : JSON.stringify(out.response || out);
      const m = t.match(/[\[{][\s\S]*[\]}]/);
      if (m) return JSON.parse(m[0]);
      last = 'no JSON';
    } catch (err) { last = err && err.message || String(err); }
  }
  throw new Error('Could not understand that: ' + last);
}

async function parseSpoken(env, text) {
  if (!(text || '').trim()) throw new Error('Say or type what you spent');
  const today = new Date().toISOString().slice(0, 10);
  const r = await askJson(env, `A UK tradesman said this about something he paid for: "${String(text).slice(0, 500)}"
Today is ${today}. Reply with ONLY a JSON object:
{"supplier": "", "date": "YYYY-MM-DD", "total": 0.00, "vat": 0.00, "category": "", "items": ""}
- "40 quid" means 40.00. Use today's date unless he says another day ("yesterday" etc).
- vat: only if he mentions VAT, else 0.
- category: one of ${CATEGORIES.join(', ')}.
- supplier: the shop if he says one, else "".`);
  return {
    supplier: String(r.supplier || ''), date: /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : today,
    total: Number(r.total) || 0, vat: Number(r.vat) || 0,
    category: CATEGORIES.includes(r.category) ? r.category : 'Other', items: String(r.items || ''), readable: Number(r.total) > 0,
  };
}

// ---------- tidy up: expenses left in Uncategorised ----------

async function untidy(env, store, realmId) {
  const list = (await query(env, store, realmId, 'select * from Purchase orderby TxnDate desc maxresults 300')).Purchase || [];
  const items = [];
  for (const p of list) {
    for (const l of p.Line || []) {
      const acc = l.AccountBasedExpenseLineDetail && l.AccountBasedExpenseLineDetail.AccountRef;
      if (acc && /uncategori[sz]ed/i.test(acc.name || '')) {
        items.push({ id: p.Id, date: p.TxnDate, amount: Number(l.Amount), supplier: (p.EntityRef && p.EntityRef.name) || '', note: [l.Description, p.PrivateNote].filter(Boolean).join(' · ') });
        break;
      }
    }
  }
  if (items.length && env.AI) {
    try {
      const guesses = await askJson(env, `For each UK trade business expense below, pick the best category from: ${CATEGORIES.join(', ')}.
Reply with ONLY a JSON array of category names, same order, same length.
${items.slice(0, 30).map((i, n) => `${n + 1}. ${i.supplier || 'unknown supplier'} £${i.amount} ${i.note}`).join('\n')}`);
      items.slice(0, 30).forEach((i, n) => { i.suggested = CATEGORIES.includes(guesses[n]) ? guesses[n] : 'Other'; });
    } catch (err) { /* suggestions are a bonus; the list still works without them */ }
  }
  return items;
}

async function tidy(env, store, realmId, id, category) {
  if (!CATEGORIES.includes(category)) throw new Error('Pick a category');
  const p = (await qb(env, store, realmId, 'GET', `purchase/${id}`)).Purchase;
  const accounts = (await query(env, store, realmId, 'select Id, Name, AccountType, Active from Account maxresults 1000')).Account || [];
  const target = pickAccount(accounts.filter(a => a.AccountType === 'Expense' || a.AccountType === 'Cost of Goods Sold'), category);
  let changed = 0;
  for (const l of p.Line || []) {
    const d = l.AccountBasedExpenseLineDetail;
    if (d && d.AccountRef && /uncategori[sz]ed/i.test(d.AccountRef.name || '')) { d.AccountRef = { value: target.Id }; changed++; }
  }
  if (!changed) return { ok: true, account: target.Name, unchanged: true };
  await qb(env, store, realmId, 'POST', 'purchase', p);
  return { ok: true, account: target.Name };
}

// ---------- the Making Tax Digital quarter ----------

// Standard MTD quarters: 6 Apr-5 Jul, 6 Jul-5 Oct, 6 Oct-5 Jan, 6 Jan-5 Apr. Updates are due on the 7th of the month after.
function mtdQuarter(dateStr) {
  const d = new Date((dateStr && Date.parse(dateStr)) ? dateStr : Date.now());
  const y = d.getUTCFullYear();
  const starts = [[y - 1, 9, 6], [y, 0, 6], [y, 3, 6], [y, 6, 6], [y, 9, 6]].map(([yy, mm, dd]) => new Date(Date.UTC(yy, mm, dd)));
  let start = starts[0];
  for (const s of starts) if (s <= d) start = s;
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 5));
  const due = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 7));
  const iso = x => x.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(end), due: iso(due) };
}

async function quarter(env, store, realmId, dateStr) {
  const q = mtdQuarter(dateStr);
  const report = await qb(env, store, realmId, 'GET', `reports/ProfitAndLoss?start_date=${q.from}&end_date=${q.to}`);
  const lines = [], totals = {};
  const walk = (rows, section) => {
    for (const row of rows || []) {
      const sec = row.group || section;
      if (row.ColData) {
        const amt = Number(row.ColData[row.ColData.length - 1].value) || 0;
        if (amt) lines.push({ section: sec, name: row.ColData[0].value, amount: round(amt) });
      }
      if (row.Rows) walk(row.Rows.Row, sec);
      if (row.group && row.Summary) totals[row.group] = Number(row.Summary.ColData[row.Summary.ColData.length - 1].value) || 0;
    }
  };
  walk(report.Rows && report.Rows.Row, '');
  const income = round(totals.Income || 0), expenses = round((totals.COGS || 0) + (totals.Expenses || 0) + (totals.OtherExpenses || 0));
  return { ...q, income, expenses, profit: round(income - expenses), lines };
}

// ---------- monthly text and check report ----------

async function getClient(store, realmId) {
  const res = await store.fetch(`https://store/clients/${realmId}`);
  return res.ok ? res.json() : null;
}

function lastMonth() {
  const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

const gbp = n => '£' + Math.round(n).toLocaleString('en-GB');

async function monthlyText(env, store, realmId, month) {
  const m = month || lastMonth();
  const s = await summary(env, store, realmId, m);
  const inv = await owed(env, store, realmId);
  const messy = await untidy(env, store, realmId).catch(() => []);
  const name = new Date(m + '-01').toLocaleDateString('en-GB', { month: 'long' });
  const parts = [`Your books for ${name}: in ${gbp(s.moneyIn)}, out ${gbp(s.moneyOut)}, profit ${gbp(s.profit)}.`];
  if (inv.length) parts.push(`Owed to you: ${gbp(s.owed)} on ${inv.length} invoice${inv.length > 1 ? 's' : ''}${inv[0].daysOverdue ? `, oldest ${inv[0].daysOverdue} days late` : ''}.`);
  if (s.taxPot > 0) parts.push(`Put aside roughly ${gbp(s.taxPot)} for tax (a guide, not advice).`);
  if (messy.length) parts.push(`${messy.length} expense${messy.length > 1 ? 's need' : ' needs'} a category: open Books, Tidy up.`);
  return parts.join(' ');
}

async function monthlyRun(env) {
  const store = env.STORE.get(env.STORE.idFromName('main'));
  const companies = await (await store.fetch('https://store/tokens')).json();
  const report = [];
  for (const c of companies) {
    const client = await getClient(store, c.realmId);
    try {
      const msg = await monthlyText(env, store, c.realmId);
      if (client && client.phone) await sendSms(env, client.phone, msg);
      const messy = (msg.match(/(\d+) expenses? needs? a category/) || [])[1] || 0;
      report.push(`${(client && client.name) || c.realmId}: ${client && client.phone ? 'text sent' : 'no phone saved'}, ${messy} to tidy.`);
    } catch (err) {
      report.push(`${(client && client.name) || c.realmId}: FAILED (${err.message}).`);
    }
  }
  if (env.OWNER_PHONE) await sendSms(env, env.OWNER_PHONE, `Books monthly check: ${report.join(' ') || 'no clients connected.'}`);
}

async function sendSms(env, to, body) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) throw new Error('Texts are not set up yet (Twilio keys missing)');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: env.SMS_FROM || 'Books', To: to, Body: body.slice(0, 900) }),
  });
  if (!res.ok) throw new Error(`Text failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

function round(n) { return Math.round((Number(n) || 0) * 100) / 100; }

// One QuickBooks API call. Body may be JSON-able or FormData.
async function qb(env, store, realmId, method, path, body) {
  const t = await accessToken(env, store, realmId);
  const base = t.env === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com';
  const access = t.access_token;
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

// Fresh tokens for this company (with .env), refreshing and saving the new refresh token when needed.
// Connections saved before env was recorded are sandbox ones.
async function accessToken(env, store, realmId) {
  const res = await store.fetch(`https://store/tokens/${realmId}`);
  if (!res.ok) throw new Error(`QuickBooks company ${realmId} isn't connected`);
  const t = await res.json();
  t.env = t.env || 'sandbox';
  if (t.expires_at - Date.now() > 60_000) return t;
  const fresh = await tokenRequest(env, t.env, { grant_type: 'refresh_token', refresh_token: t.refresh_token });
  await store.fetch(`https://store/tokens/${realmId}`, { method: 'PUT', body: JSON.stringify(fresh) });
  return fresh;
}

async function tokenRequest(env, which, params) {
  const c = creds(env, which);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${c.id}:${c.secret}`),
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
    env: which,
  };
}

// One instance holds every client's tokens, so refreshes never race each other.
export class Store {
  constructor(state) { this.storage = state.storage; }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/state') {
      // Several people may be connecting at once, so each state is kept under its own key.
      if (request.method === 'PUT') { const st = JSON.parse(await request.text()); await this.storage.put(`state:${st.value}`, { ...st, at: Date.now() }); return text('ok'); }
      const value = await request.text();
      const saved = await this.storage.get(`state:${value}`);
      await this.storage.delete(`state:${value}`);
      return saved && Date.now() - saved.at < 15 * 60_000 ? Response.json(saved) : text('expired', 400);
    }
    const inv = url.pathname.match(/^\/invites\/([\w-]+)$/);
    if (inv) {
      const key = `invite:${inv[1]}`;
      if (request.method === 'PUT') { await this.storage.put(key, JSON.parse(await request.text())); return text('ok'); }
      if (request.method === 'DELETE') { await this.storage.delete(key); return text('ok'); }
      const v = await this.storage.get(key);
      return v && Date.now() - v.created < INVITE_DAYS * 86400000 ? Response.json(v) : text('No invite', 404);
    }
    const ak = url.pathname.match(/^\/appkeys\/([\w-]+)$/);
    if (ak) {
      const realmId = await this.storage.get(`appkey:${ak[1]}`);
      if (!realmId) return text('Unknown', 404);
      const client = await this.storage.get(`client:${realmId}`);
      return Response.json({ realmId, name: (client && client.name) || '', brand: (client && client.brand) || '' });
    }
    const c = url.pathname.match(/^\/clients\/(\d+)$/);
    if (c) {
      const key = `client:${c[1]}`;
      if (request.method === 'PUT') {
        const v = JSON.parse(await request.text());
        const old = await this.storage.get(key);
        if (old && old.appKey && old.appKey !== v.appKey) await this.storage.delete(`appkey:${old.appKey}`);
        await this.storage.put(key, v);
        if (v.appKey) await this.storage.put(`appkey:${v.appKey}`, c[1]);
        return text('ok');
      }
      if (request.method === 'DELETE') {
        const old = await this.storage.get(key);
        if (old && old.appKey) await this.storage.delete(`appkey:${old.appKey}`);
        await this.storage.delete(key);
        return text('ok');
      }
      const v = await this.storage.get(key);
      return v ? Response.json(v) : text('No client', 404);
    }
    const m = url.pathname.match(/^\/tokens(?:\/(\d+))?$/);
    if (!m) return text('Not found', 404);
    if (!m[1]) {
      const all = await this.storage.list({ prefix: 'tokens:' });
      return Response.json([...all].map(([k, t]) => ({ realmId: k.slice(7), connected_at: t.saved_at, refresh_expires_at: new Date(t.refresh_expires_at).toISOString() })));
    }
    const key = `tokens:${m[1]}`;
    if (request.method === 'PUT') { await this.storage.put(key, JSON.parse(await request.text())); return text('ok'); }
    if (request.method === 'DELETE') { await this.storage.delete(key); return text('ok'); }
    const t = await this.storage.get(key);
    return t ? Response.json(t) : text('Not connected', 404);
  }
}

function text(body, status = 200) { return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
function page(msg) {
  return new Response(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>QuickBooks</title><body style="font:18px system-ui;display:grid;place-items:center;min-height:90vh;margin:0;padding:16px;text-align:center"><p>${msg}</p></body>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
