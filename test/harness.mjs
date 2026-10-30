// Test harness for the Books workers. Everything here is fake: an in-memory Durable Object store, a pretend
// QuickBooks, Intuit login, Twilio and AI, and made-up keys. Nothing in these tests can reach a real service.
//
// Run all tests:  node --test test/
import { Store } from '../workers/books/worker.js';
import books from '../workers/books/worker.js';
import app from '../workers/receipt-demo/worker.js';

export { books, app };
export const ADMIN = 'test-admin-key-not-a-real-key';
export const REALM = '1111111111111111';      // a "production" test company
export const SANDBOX_REALM = '2222222222222222';

export const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');

// A Durable Object storage that behaves like the real one for the calls Books makes.
export class MemStorage {
  constructor() { this.m = new Map(); }
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
  async delete(k) {
    if (Array.isArray(k)) { if (k.length > 128) throw new Error('A Durable Object takes at most 128 keys per delete'); let n = 0; for (const x of k) if (this.m.delete(x)) n++; return n; }
    return this.m.delete(k);
  }
  async list({ prefix = '', start, end, reverse = false, limit } = {}) {
    let keys = [...this.m.keys()].filter(k => k.startsWith(prefix) && (start === undefined || k >= start) && (end === undefined || k < end)).sort();
    if (reverse) keys.reverse();
    if (limit) keys = keys.slice(0, limit);
    return new Map(keys.map(k => [k, structuredClone(this.m.get(k))]));
  }
  keys() { return [...this.m.keys()]; }
}

// A pretend QuickBooks company: just enough tables and routes for the code under test.
export class FakeQB {
  constructor() {
    this.sent = [];   // every "send this invoice/quote by email" request
    this.calls = [];  // every request, for "was this ever called?" checks
    this.n = 100;
    this.t = {
      Customer: [], Vendor: [], Invoice: [], Estimate: [], Purchase: [], Payment: [], Attachable: [],
      Item: [{ Id: '1', Name: 'Services', Type: 'Service', Active: true }],
      TaxCode: [{ Id: '3', Name: '20.0% S' }, { Id: '8', Name: '5.0% R' }, { Id: '12', Name: 'No VAT' }],
      Preferences: [{ TaxPrefs: { UsingSalesTax: true } }],
      Account: [{ Id: '81', Name: 'Current', AccountType: 'Bank', Active: true }, { Id: '64', Name: 'Purchases', AccountType: 'Cost of Goods Sold', Active: true }, { Id: '79', Name: 'Uncategorised Expense', AccountType: 'Expense', Active: true }],
    };
    this.files = {}; // TempDownloadUri -> bytes
  }
  add(entity, row) { row.Id = row.Id || String(++this.n); this.t[entity].push(row); return row; }
  handle(url, init = {}) {
    const u = new URL(url), method = (init.method || 'GET').toUpperCase();
    const path = decodeURIComponent(u.pathname.replace(/^\/v3\/company\/\d+\//, ''));
    this.calls.push({ method, path, query: u.search });
    const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : null;
    const Ent = (w) => w.charAt(0).toUpperCase() + w.slice(1);
    const fault = (m) => Response.json({ Fault: { Error: [{ Message: m, Detail: m }], type: 'ValidationFault' } }, { status: 400 });
    if (path === 'query') {
      const sql = u.searchParams.get('query'), ent = (sql.match(/from\s+(\w+)/i) || [])[1];
      let rows = this.t[ent] || [];
      for (const [, f, v] of sql.matchAll(/(\w+)\s*=\s*'([^']*)'/g)) if (rows.length && f in rows[0]) rows = rows.filter(r => String(r[f]) === v.replace(/\\'/g, "'"));
      const start = Number((sql.match(/startposition\s+(\d+)/i) || [])[1] || 1), max = Number((sql.match(/maxresults\s+(\d+)/i) || [])[1] || 100);
      this.queries = (this.queries || 0) + 1;
      rows = rows.slice(start - 1, start - 1 + max); // like QuickBooks: pages of at most `max`
      return Response.json({ QueryResponse: rows.length ? { [ent]: rows } : {} });
    }
    if (path.startsWith('reports/')) return Response.json({ Rows: { Row: [] } });
    if (path.startsWith('companyinfo/')) return Response.json({ CompanyInfo: { CompanyName: 'Test Company' } });
    let m = path.match(/^(\w+)\/(\d+)\/send$/);
    if (m && method === 'POST') { this.sent.push({ kind: m[1], id: m[2], to: u.searchParams.get('sendTo') }); return Response.json({ [Ent(m[1])]: { Id: m[2] } }); }
    m = path.match(/^(\w+)\/(\d+)$/);
    if (m && method === 'GET') {
      const row = (this.t[Ent(m[1])] || []).find(r => r.Id === m[2]);
      return row ? Response.json({ [Ent(m[1])]: row }) : fault('Object Not Found');
    }
    m = path.match(/^(\w+)$/);
    if (m && method === 'POST' && this.t[Ent(m[1])] && body) {
      const E = Ent(m[1]);
      if (u.searchParams.get('operation') === 'delete') return Response.json({ [E]: { Id: body.Id, status: 'Deleted' } });
      if (body.Id) { const row = this.t[E].find(r => r.Id === body.Id); Object.assign(row, body); return Response.json({ [E]: row }); }
      const row = { ...body, Id: String(++this.n), SyncToken: '0', MetaData: { CreateTime: new Date().toISOString() } };
      if (E === 'Invoice' || E === 'Estimate') { row.TotalAmt = (body.Line || []).reduce((s, l) => s + Number(l.Amount || 0), 0); row.DocNumber = String(1000 + this.t[E].length); row.TxnDate = row.TxnDate || new Date().toISOString().slice(0, 10); if (E === 'Invoice') row.Balance = row.TotalAmt; }
      if (E === 'Customer') row.DisplayName = body.DisplayName;
      this.t[E].push(row);
      return Response.json({ [E]: row });
    }
    return fault('Unmocked QuickBooks route: ' + method + ' ' + path);
  }
}


// A stand-in for FreeAgent's API (https://dev.freeagent.com/docs), shaped like the real responses. Nothing real is ever contacted.
export class FakeFA {
  constructor() {
    this.n = 500; this.calls = []; this.mails = []; this.refreshes = 0; this.fail429 = 0;
    this.company = { name: 'Test Plumbing Ltd', sales_tax_registration_status: 'Registered' };
    this.categories = { admin_expenses_categories: [{ url: 'https://api.freeagent.com/v2/categories/285', description: 'Motor Expenses' }, { url: 'https://api.freeagent.com/v2/categories/363', description: 'General Admin Expenses' }], cost_of_sales_categories: [{ url: 'https://api.freeagent.com/v2/categories/310', description: 'Materials Purchased' }] };
    this.expenses = []; this.contacts = []; this.invoices = []; this.pl = { income: 4200, expenses: 1300, operating_profit: 2900 };
  }
  handle(url, init = {}) {
    const u = new URL(url), method = (init.method || 'GET').toUpperCase(), path = u.pathname.replace(/^\/v2/, '');
    const body = init.body && typeof init.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : null;
    this.calls.push({ method, path, query: u.search, host: u.host, auth: (init.headers || {}).Authorization, ua: (init.headers || {})['User-Agent'], body });
    const ok = (o, status = 200) => Response.json(o, { status });
    if (path === '/token_endpoint') {
      const p = new URLSearchParams(String(init.body));
      if (p.get('grant_type') === 'refresh_token') { this.refreshes++; return ok({ access_token: 'fa-access-' + this.refreshes, token_type: 'bearer', expires_in: 604800 }); }
      if (p.get('code') === 'bad') return ok({ error: 'invalid_grant', error_description: 'code expired' }, 400);
      return ok({ access_token: 'fa-access-0', refresh_token: 'fa-refresh-0', token_type: 'bearer', expires_in: 604800 });
    }
    if (this.fail429 > 0) { this.fail429--; return ok({ errors: [{ message: 'Too many requests' }] }, 429); }
    if (path === '/users/me') return ok({ user: { url: 'https://api.freeagent.com/v2/users/4242', first_name: 'Test' } });
    if (path === '/company') return ok({ company: this.company });
    if (path === '/categories') return ok(this.categories);
    if (path === '/expenses' && method === 'GET') { const from = u.searchParams.get('from_date'), to = u.searchParams.get('to_date'); return ok({ expenses: this.expenses.filter(e => (!from || e.dated_on >= from) && (!to || e.dated_on <= to)) }); }
    if (path === '/expenses' && method === 'POST') { const e = { ...body.expense, url: `https://api.freeagent.com/v2/expenses/${++this.n}` }; if (body.expense.attachment) e.attachment = { content_type: body.expense.attachment.content_type }; else delete e.attachment; e.hasAttachment = Boolean(body.expense.attachment); this.expenses.push(e); return ok({ expense: e }, 201); }
    let m = path.match(/^\/expenses\/(\d+)$/);
    if (m && method === 'DELETE') { this.expenses = this.expenses.filter(e => !e.url.endsWith('/' + m[1])); return new Response(null, { status: 200 }); }
    if (path === '/contacts' && method === 'GET') return ok({ contacts: this.contacts });
    if (path === '/contacts' && method === 'POST') { const c = { ...body.contact, url: `https://api.freeagent.com/v2/contacts/${++this.n}` }; this.contacts.push(c); return ok({ contact: c }, 201); }
    if (path === '/invoices' && method === 'GET') return ok({ invoices: this.invoices.filter(i => Number(i.due_value) > 0) });
    if (path === '/invoices' && method === 'POST') {
      const items = body.invoice.invoice_items, net = items.reduce((t, i) => t + Number(i.price) * Number(i.quantity), 0), rate = Number((items[0] || {}).sales_tax_rate || 0);
      const inv = { ...body.invoice, url: `https://api.freeagent.com/v2/invoices/${++this.n}`, reference: `INV-${100 + this.invoices.length}`, total_value: String((net * (1 + rate / 100)).toFixed(2)), due_value: String((net * (1 + rate / 100)).toFixed(2)), due_on: body.invoice.dated_on };
      this.invoices.push(inv); return ok({ invoice: inv }, 201);
    }
    m = path.match(/^\/invoices\/(\d+)\/transitions\/(mark_as_sent|mark_as_draft)$/);
    if (m && method === 'PUT') { const i = this.invoices.find(x => x.url.endsWith('/' + m[1])); if (i) i.status = m[2] === 'mark_as_sent' ? 'Sent' : 'Draft'; return ok({}); }
    m = path.match(/^\/invoices\/(\d+)$/);
    if (m && method === 'DELETE') { const i = this.invoices.find(x => x.url.endsWith('/' + m[1])); if (i && i.status !== 'Draft') return ok({ errors: [{ message: 'Only draft invoices can be deleted' }] }, 422); this.invoices = this.invoices.filter(x => x !== i); return new Response(null, { status: 200 }); }
    m = path.match(/^\/contacts\/(\d+)$/);
    if (m && method === 'DELETE') { this.contacts = this.contacts.filter(c => !c.url.endsWith('/' + m[1])); return new Response(null, { status: 200 }); }
    m = path.match(/^\/invoices\/(\d+)\/send_email$/);
    if (m && method === 'POST') { this.mails.push({ id: m[1], to: body.invoice.email.to }); return ok({}); }
    if (path === '/accounting/profit_and_loss/summary') return ok({ profit_and_loss_summary: this.pl });
    return ok({ errors: [{ message: 'Unmocked FreeAgent route: ' + method + ' ' + path }] }, 404);
  }
}


// A small pretend Xero: just the routes Books uses, with Xero's real field names, id formats and /Date-free DateString values.
export class FakeXero {
  constructor() {
    this.n = 0; this.calls = []; this.refreshes = 0; this.fail429 = 0; this.mails = [];
    this.tenant = '8a7f3c10-1111-4222-8333-444455556666';
    this.org = { Name: 'Demo Company (UK)', SalesTaxBasis: 'ACCRUAL', IsDemoCompany: true };
    this.accounts = [
      { AccountID: 'acc-bank', Code: '090', Name: 'Business Bank Account', Type: 'BANK' },
      { AccountID: 'acc-motor', Code: '449', Name: 'Motor Vehicle Expenses', Type: 'OVERHEADS' },
      { AccountID: 'acc-cos', Code: '300', Name: 'Purchases', Type: 'DIRECTCOSTS' },
      { AccountID: 'acc-gen', Code: '429', Name: 'General Expenses', Type: 'OVERHEADS' },
      { AccountID: 'acc-susp', Code: '999', Name: 'Suspense', Type: 'EXPENSE' }];
    this.tx = []; this.contacts = []; this.invoices = []; this.attachments = {};
    this.pl = { 'Total Income': '4200.00', 'Total Cost of Sales': '300.00', 'Total Operating Expenses': '1000.00', 'Net Profit': '2900.00' };
  }
  id(p) { return `${p}-${++this.n}`; }
  handle(url, init = {}) {
    const u = new URL(url), method = (init.method || 'GET').toUpperCase(), path = u.pathname.replace(/^\/api\.xro\/2\.0/, '');
    const h = init.headers || {};
    const body = init.body && typeof init.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : null;
    this.calls.push({ method, path, query: u.search, auth: h.Authorization, tenant: h['xero-tenant-id'], ua: h['User-Agent'], body });
    const ok = (o, status = 200) => Response.json(o, { status });
    if (u.host === 'identity.xero.com') {
      const p = new URLSearchParams(String(init.body));
      if (p.get('grant_type') === 'refresh_token') { this.refreshes++; return ok({ access_token: 'xe-access-' + this.refreshes, refresh_token: 'xe-refresh-' + this.refreshes, expires_in: 1800 }); }
      if (p.get('code') === 'bad') return ok({ error: 'invalid_grant' }, 400);
      return ok({ access_token: 'xe-access-0', refresh_token: 'xe-refresh-0', expires_in: 1800 });
    }
    if (path === '/connections' && method === 'GET') return ok([{ id: 'conn-1', tenantId: this.tenant, tenantType: 'ORGANISATION', tenantName: this.org.Name }]);
    let m = path.match(/^\/connections\/(.+)$/);
    if (m && method === 'DELETE') { this.disconnected = m[1]; return new Response(null, { status: 200 }); }
    if (this.fail429 > 0) { this.fail429--; return new Response('{}', { status: 429, headers: { 'Retry-After': '0' } }); }
    if (path === '/Organisation') return ok({ Organisations: [this.org] });
    if (path === '/Accounts' && method === 'GET') { const w = decodeURIComponent(u.searchParams.get('where') || ''); return ok({ Accounts: this.accounts.filter(x => (!/Type=="BANK"/.test(w) || x.Type === 'BANK') && (!/Status=="ACTIVE"/.test(w) || x.Status !== 'ARCHIVED')) }); }
    if (path === '/Accounts' && method === 'PUT') { const x = { ...body, AccountID: this.id('acc'), Status: 'ACTIVE' }; this.accounts.push(x); return ok({ Accounts: [x] }); }
    m = path.match(/^\/Accounts\/([^/]+)$/); if (m && method === 'POST') { const x = this.accounts.find(y => y.AccountID === m[1]); if (x) Object.assign(x, body); return ok({ Accounts: [x] }); }
    if (path === '/Contacts' && method === 'GET') { const w = u.searchParams.get('where') || '', n = (/Name=="(.*)"/.exec(w) || [])[1]; return ok({ Contacts: this.contacts.filter(c => !n || c.Name === n) }); }
    if (path === '/Contacts' && method === 'PUT') { const c = { ...body, ContactID: this.id('contact'), ContactStatus: 'ACTIVE' }; this.contacts.push(c); return ok({ Contacts: [c] }); }
    m = path.match(/^\/Contacts\/(.+)$/);
    if (m && method === 'POST') { const c = this.contacts.find(x => x.ContactID === m[1]); if (c) c.ContactStatus = body.ContactStatus; return ok({ Contacts: [c] }); }
    const when = (b) => `${b.Date}T00:00:00`;
    if (path === '/BankTransactions' && method === 'GET') {
      const w = decodeURIComponent(u.searchParams.get('where') || ''), eq = /Date==DateTime\((\d+),(\d+),(\d+)\)/.exec(w), ge = /Date>=DateTime\((\d+),(\d+),(\d+)\)/.exec(w);
      const iso = (x) => `${x[1]}-${String(x[2]).padStart(2, '0')}-${String(x[3]).padStart(2, '0')}`;
      return ok({ BankTransactions: this.tx.filter(b => (!eq || b.Date === iso(eq)) && (!ge || b.Date >= iso(ge))).sort((a, b) => b.Date.localeCompare(a.Date)) });
    }
    if (path === '/BankTransactions' && method === 'PUT') {
      const total = body.LineItems.reduce((t, l) => t + l.UnitAmount * l.Quantity, 0);
      const b = { ...body, BankTransactionID: this.id('bt'), Status: 'AUTHORISED', Total: total, DateString: when(body), HasAttachments: false, Contact: { Name: body.Contact.Name } };
      this.tx.push(b); return ok({ BankTransactions: [b] });
    }
    m = path.match(/^\/BankTransactions\/([^/]+)$/);
    if (m && method === 'GET') return ok({ BankTransactions: this.tx.filter(b => b.BankTransactionID === m[1]) });
    if (m && method === 'POST') { const b = this.tx.find(x => x.BankTransactionID === m[1]); if (b) Object.assign(b, body); return ok({ BankTransactions: [b] }); }
    m = path.match(/^\/BankTransactions\/([^/]+)\/Attachments\/(.+)$/);
    if (m && method === 'PUT') { const b = this.tx.find(x => x.BankTransactionID === m[1]); if (b) b.HasAttachments = true; this.attachments[m[1]] = { name: m[2], type: h['Content-Type'] }; return ok({ Attachments: [{ FileName: m[2] }] });}
    if (path === '/Invoices' && method === 'GET') {
      const st = (u.searchParams.get('Statuses') || '').split(',');
      return ok({ Invoices: this.invoices.filter(i => (!st[0] || st.includes(i.Status)) && i.Type === 'ACCREC') });
    }
    if (path === '/Invoices' && method === 'PUT') {
      const net = body.LineItems.reduce((t, l) => t + l.UnitAmount * l.Quantity, 0), rate = ({ OUTPUT2: 0.2, RROUTPUT: 0.05 })[body.LineItems[0].TaxType] || 0;
      const total = Math.round(net * (1 + rate) * 100) / 100, c = this.contacts.find(x => x.ContactID === body.Contact.ContactID);
      const inv = { ...body, InvoiceID: this.id('inv'), InvoiceNumber: `INV-${String(this.invoices.length + 1).padStart(4, '0')}`, Total: total, AmountDue: total, DateString: `${body.Date}T00:00:00`, DueDateString: `${body.DueDate}T00:00:00`, Contact: { ContactID: c.ContactID, Name: c.Name, EmailAddress: c.EmailAddress } };
      this.invoices.push(inv); return ok({ Invoices: [inv] });
    }
    m = path.match(/^\/Invoices\/([^/]+)\/Email$/);
    if (m && method === 'POST') { this.mails.push({ id: m[1] }); return ok({}); }
    m = path.match(/^\/Invoices\/([^/]+)$/);
    if (m && method === 'POST') { const i = this.invoices.find(x => x.InvoiceID === m[1]); if (i) { i.Status = body.Status; if (body.Status === 'VOIDED') i.AmountDue = 0; } return ok({ Invoices: [i] }); }
    if (path === '/Reports/ProfitAndLoss') {
      const row = (k, v) => ({ RowType: 'Row', Cells: [{ Value: k }, { Value: v }] });
      return ok({ Reports: [{ Rows: [{ RowType: 'Header', Cells: [{ Value: '' }, { Value: 'Total' }] }, { RowType: 'Section', Title: 'Income', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Income' }, { Value: this.pl['Total Income'] }] }] },
        { RowType: 'Section', Title: 'Less Cost of Sales', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Cost of Sales' }, { Value: this.pl['Total Cost of Sales'] }] }] },
        { RowType: 'Section', Title: 'Less Operating Expenses', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Operating Expenses' }, { Value: this.pl['Total Operating Expenses'] }] }] },
        { RowType: 'Section', Title: '', Rows: [row('Net Profit', this.pl['Net Profit'])] }] }] });
    }
    return ok({ Message: 'Unmocked Xero route: ' + method + ' ' + path }, 404);
  }
}

// Replaces global fetch for one test. Returns what was called, plus the fake QuickBooks and SMS log.
export function network(t, { token } = {}) {
  const original = globalThis.fetch;
  const qb = new FakeQB(), fa = new FakeFA(), xe = new FakeXero();
  const log = { sms: [], revokes: 0, tokenCalls: 0, other: [], downloads: [] };
  const state = { token: token || (() => Response.json({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 3600, x_refresh_token_expires_in: 8640000 })) };
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/quickbooks\.api\.intuit\.com/.test(url)) return qb.handle(url, init);
    if (/api\.(sandbox\.)?freeagent\.com/.test(url)) return fa.handle(url, init);
    if (/(api|identity)\.xero\.com/.test(url)) return xe.handle(url, init);
    if (/oauth\.platform\.intuit\.com/.test(url)) { log.tokenCalls++; return state.token(init); }
    if (/developer\.api\.intuit\.com/.test(url)) { log.revokes++; return new Response('{}'); }
    if (/api\.twilio\.com/.test(url)) { log.sms.push(Object.fromEntries(new URLSearchParams(String(init.body)))); return Response.json({}, { status: 201 }); }
    if (/download\.test/.test(url)) { log.downloads.push(url); return new Response(qb.files[url] || 'file-bytes', { headers: { 'Content-Type': 'image/jpeg' } }); }
    log.other.push(url);
    return new Response('unmocked ' + url, { status: 599 });
  };
  t.after(() => { globalThis.fetch = original; });
  return { qb, fa, xe, log, state };
}

// One fresh world: storage, Store stub, env for the books worker, env for the app worker.
export function world(extra = {}) {
  const storage = new MemStorage();
  const store = new Store({ storage });
  const stub = { fetch: (u, init) => store.fetch(u instanceof Request ? u : new Request(u, init)) };
  const ai = { calls: 0, reply: null, run: async () => { ai.calls++; if (ai.reply) return { response: JSON.stringify(ai.reply) }; return { response: JSON.stringify({ supplier: 'Shell', date: '2026-10-30', total: 40, vat: 6.67, category: 'Fuel', items: 'diesel', readable: true }) }; } };
  const booksEnv = {
    STORE: { idFromName: () => 'main', get: () => stub },
    ADMIN_KEY: ADMIN, QB_CLIENT_ID: 'sandbox-id', QB_CLIENT_SECRET: 'sandbox-secret', QB_PROD_CLIENT_ID: 'prod-id', QB_PROD_CLIENT_SECRET: 'prod-secret',
    TWILIO_ACCOUNT_SID: 'ACtest', TWILIO_AUTH_TOKEN: 'twilio-test-token', SMS_FROM: 'Books', OWNER_PHONE: '+447700900001',
    APP_URL: 'https://app.test', BOOKS_URL: 'https://books.test', AI: ai, FA_SANDBOX_CLIENT_ID: 'fa-sandbox-id', FA_SANDBOX_CLIENT_SECRET: 'fa-sandbox-secret', FA_CLIENT_ID: 'fa-prod-id', FA_CLIENT_SECRET: 'fa-prod-secret', XERO_CLIENT_ID: 'xero-id', XERO_CLIENT_SECRET: 'xero-secret', ...extra,
  };
  const appEnv = {
    AI: ai,
    BOOKS: { fetch: (u, init) => books.fetch(new Request(u, init && init.body && typeof init.body !== "string" ? { ...init, duplex: "half" } : init), booksEnv) },
  };
  return { storage, store: stub, booksEnv, appEnv, ai };
}

// Seeds a client (and optionally its QuickBooks connection) the way a real connect does.
export async function seedClient(w, { realm = REALM, appKey = 'appkey-' + realm, name = 'Test Plumbing', phone = '+447700900002', env = 'production', tokens = true, ...rest } = {}) {
  const client = { name, phone, appKey, brand: '', extras: '', chase: 'off', connected_at: new Date().toISOString(), ...rest };
  await w.storage.put(`client:${realm}`, client);
  await w.storage.put(`appkey:${appKey}`, realm);
  if (tokens) await w.storage.put(`tokens:${realm}`, { access_token: 'access-1', refresh_token: 'refresh-1', expires_at: Date.now() + 3600_000, refresh_expires_at: Date.now() + 86400_000 * 90, saved_at: new Date().toISOString(), env });
  return { realm, appKey, client };
}
export async function seedSession(w, appKey) {
  const raw = 'session-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  await w.storage.put(`session:${await sha256(raw)}`, { appKey, created: Date.now() });
  return raw;
}

// Calls the books worker directly (as the internet would).
export const callBooks = (w, method, path, { headers = {}, body, key } = {}) =>
  books.fetch(new Request('https://books.test' + path, { method, headers: { ...(key ? { 'X-Key': key } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), w.booksEnv);
export const asAdmin = (w, method, path, body) => callBooks(w, method, path, { key: ADMIN, body });
// Calls the app worker (what a phone or laptop does).
export const callApp = (w, method, path, { headers = {}, body, raw } = {}) =>
  app.fetch(new Request('https://app.test' + path, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body) }), w.appEnv);

// Runs a scheduled job and waits for it.
export async function runCron(w, cron) {
  const waits = [];
  await books.scheduled({ cron }, w.booksEnv, { waitUntil: p => waits.push(p) });
  await Promise.all(waits);
}
