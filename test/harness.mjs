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

// Replaces global fetch for one test. Returns what was called, plus the fake QuickBooks and SMS log.
export function network(t, { token } = {}) {
  const original = globalThis.fetch;
  const qb = new FakeQB();
  const log = { sms: [], revokes: 0, tokenCalls: 0, other: [], downloads: [] };
  const state = { token: token || (() => Response.json({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 3600, x_refresh_token_expires_in: 8640000 })) };
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/quickbooks\.api\.intuit\.com/.test(url)) return qb.handle(url, init);
    if (/oauth\.platform\.intuit\.com/.test(url)) { log.tokenCalls++; return state.token(init); }
    if (/developer\.api\.intuit\.com/.test(url)) { log.revokes++; return new Response('{}'); }
    if (/api\.twilio\.com/.test(url)) { log.sms.push(Object.fromEntries(new URLSearchParams(String(init.body)))); return Response.json({}, { status: 201 }); }
    if (/download\.test/.test(url)) { log.downloads.push(url); return new Response(qb.files[url] || 'file-bytes', { headers: { 'Content-Type': 'image/jpeg' } }); }
    log.other.push(url);
    return new Response('unmocked ' + url, { status: 599 });
  };
  t.after(() => { globalThis.fetch = original; });
  return { qb, log, state };
}

// One fresh world: storage, Store stub, env for the books worker, env for the app worker.
export function world(extra = {}) {
  const storage = new MemStorage();
  const store = new Store({ storage });
  const stub = { fetch: (u, init) => store.fetch(u instanceof Request ? u : new Request(u, init)) };
  const ai = { calls: 0, run: async () => { ai.calls++; return { response: JSON.stringify({ supplier: 'Shell', date: '2026-10-30', total: 40, vat: 6.67, category: 'Fuel', items: 'diesel', readable: true }) }; } };
  const booksEnv = {
    STORE: { idFromName: () => 'main', get: () => stub },
    ADMIN_KEY: ADMIN, QB_CLIENT_ID: 'sandbox-id', QB_CLIENT_SECRET: 'sandbox-secret', QB_PROD_CLIENT_ID: 'prod-id', QB_PROD_CLIENT_SECRET: 'prod-secret',
    TWILIO_ACCOUNT_SID: 'ACtest', TWILIO_AUTH_TOKEN: 'twilio-test-token', SMS_FROM: 'Books', OWNER_PHONE: '+447700900001',
    APP_URL: 'https://app.test', BOOKS_URL: 'https://books.test', AI: ai, ...extra,
  };
  const appEnv = {
    AI: ai,
    BOOKS: { fetch: (u, init) => books.fetch(new Request(u, init), booksEnv) },
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
