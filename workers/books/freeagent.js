// FreeAgent as a second bookkeeping platform for Books. QuickBooks code is untouched: worker.js asks this module only
// when a client's saved connection says platform "freeagent". Everything here follows FreeAgent's public API (v2):
//   authorise  GET  <base>/approve_app          token  POST <base>/token_endpoint (HTTP Basic client id and secret)
//   calls      <base>/<path> with a Bearer token, JSON in and out, a User-Agent, and a 120-a-minute rate limit.
// FreeAgent access tokens last 7 days and refresh tokens do not rotate or expire (unlike Intuit's), so refreshing is simple.
// Settings: FA_CLIENT_ID / FA_CLIENT_SECRET (live) and FA_SANDBOX_CLIENT_ID / FA_SANDBOX_CLIENT_SECRET (FreeAgent sandbox).
export const FA_PROD = 'https://api.freeagent.com/v2';
export const FA_SANDBOX = 'https://api.sandbox.freeagent.com/v2';
const UA = 'Localdesk Books (hello@localdeskai.co.uk)';
const SOFTWARE = 'FreeAgent';

export const faBase = (which) => (which === 'production' ? FA_PROD : FA_SANDBOX);
// One FreeAgent developer app works for both the sandbox and live accounts, so the live address falls back to the same keys.
export const faCreds = (env, which) => (which === 'production'
  ? { id: env.FA_CLIENT_ID || env.FA_SANDBOX_CLIENT_ID, secret: env.FA_CLIENT_SECRET || env.FA_SANDBOX_CLIENT_SECRET }
  : { id: env.FA_SANDBOX_CLIENT_ID || env.FA_CLIENT_ID, secret: env.FA_SANDBOX_CLIENT_SECRET || env.FA_CLIENT_SECRET });
export const faAuthorizeUrl = (env, which, redirectUri, state) =>
  `${faBase(which)}/approve_app?${new URLSearchParams({ client_id: faCreds(env, which).id || '', response_type: 'code', redirect_uri: redirectUri, state })}`;

const idOf = (url) => String(url || '').split('/').filter(Boolean).pop();
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

async function tokenRequest(env, which, params) {
  const c = faCreds(env, which);
  const res = await fetch(`${faBase(which)}/token_endpoint`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${c.id}:${c.secret}`), 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': UA },
    body: new URLSearchParams(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`FreeAgent said ${res.status}: ${body.error || ''} ${body.error_description || ''}`.trim());
  return body;
}

// After the customer approves: swap the code for tokens, find out who and which company, and return what to store.
export async function faExchange(env, which, redirectUri, code) {
  const t = await tokenRequest(env, which, { grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  const get = async (path) => {
    const r = await fetch(`${faBase(which)}${path}`, { headers: { Authorization: `Bearer ${t.access_token}`, Accept: 'application/json', 'User-Agent': UA } });
    if (!r.ok) throw new Error(`FreeAgent ${r.status}: couldn't read ${path}`);
    return r.json();
  };
  const [{ user }, { company }] = await Promise.all([get('/users/me'), get('/company')]);
  const realmId = `88${idOf(user.url)}`; // digits only, so it fits every route; "88" keeps it apart from QuickBooks company numbers
  const now = Date.now();
  return {
    realmId, company: company.name || '',
    tokens: {
      platform: 'freeagent', env: which, access_token: t.access_token, refresh_token: t.refresh_token,
      expires_at: now + (Number(t.expires_in) || 604800) * 1000, refresh_expires_at: now + 10 * 365 * 86400000, saved_at: new Date(now).toISOString(),
      fa_user: user.url, fa_company: company.name || '', fa_registered: company.sales_tax_registration_status === 'Registered',
    },
  };
}

export function createFreeAgent(D) { // D: { ACCOUNT_NAMES, getClient, logChange, markUndone, alertOwner, clientName, ukToday, money }
  const saved = async (store, realmId) => { const r = await store.fetch(`https://store/tokens/${realmId}`); return r.ok ? r.json() : null; };

  // Two calls at once with an expired token share ONE refresh.
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
    if (!t) throw new Error(`${SOFTWARE} company ${realmId} isn't connected`);
    if (!force && t.expires_at - Date.now() > 60_000) return t;
    let fresh;
    try { fresh = await tokenRequest(env, t.env, { grant_type: 'refresh_token', refresh_token: t.refresh_token }); } catch (err) {
      if (/invalid_grant|invalid_token|unauthor/i.test(String(err.message))) {
        await store.fetch(`https://store/tokens/${realmId}`, { method: 'DELETE' });
        const cl = await D.getClient(store, realmId);
        if (cl) await store.fetch(`https://store/clients/${realmId}`, { method: 'PUT', body: JSON.stringify({ ...cl, disconnected_at: new Date().toISOString() }) });
      }
      await D.alertOwner(env, store, `conn:${realmId}`, `Books: ${await D.clientName(store, realmId)}'s ${SOFTWARE} connection has dropped (${String(err.message).slice(0, 100)}). They may need a fresh connect link.`).catch(() => {});
      throw err;
    }
    const next = { ...t, access_token: fresh.access_token, refresh_token: fresh.refresh_token || t.refresh_token, expires_at: Date.now() + (Number(fresh.expires_in) || 604800) * 1000 };
    await store.fetch(`https://store/tokens/${realmId}`, { method: 'PUT', body: JSON.stringify(next) });
    return next;
  }

  // One FreeAgent call. 429 means "asking too often": wait and ask again (up to 3 more times).
  async function call(env, store, realmId, method, path, body) {
    const t = await token(env, store, realmId);
    let res;
    for (let attempt = 0; ; attempt++) {
      res = await fetch(`${faBase(t.env)}${path}`, {
        method, headers: { Authorization: `Bearer ${t.access_token}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status !== 429 || attempt >= 3) break;
      await new Promise(r => setTimeout(r, 700 * (attempt + 1) + Math.random() * 300));
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errs = (data.errors || []).map(e => e.message || JSON.stringify(e)).join('; ');
      throw new Error(`FreeAgent ${res.status}: ${errs || data.error_description || 'request failed'}`.trim());
    }
    return data;
  }

  const registered = async (store, realmId, t, client) => {
    const c = client || (await D.getClient(store, realmId)) || {};
    if (c.vat === 'yes') return true;
    if (c.vat === 'no') return false;
    return Boolean((t || (await saved(store, realmId)) || {}).fa_registered);
  };

  async function categories(env, store, realmId) {
    const d = await call(env, store, realmId, 'GET', '/categories');
    return [...(d.admin_expenses_categories || []), ...(d.cost_of_sales_categories || [])];
  }
  function pickCategory(cats, category) {
    const has = (n) => cats.find(c => String(c.description || '').toLowerCase().includes(n));
    for (const n of D.ACCOUNT_NAMES[category] || []) { const c = has(n); if (c) return c; }
    return has('general') || has('sundr') || has('miscell') || cats[0];
  }

  async function fileReceipt(env, store, realmId, r) {
    const total = round2(r.total), vat = round2(r.vat);
    if (!(total > 0)) throw new Error('No total on the receipt');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : D.ukToday();
    const supplier = (r.supplier || 'Unknown supplier').trim().slice(0, 100);
    const t = await token(env, store, realmId);
    // Same date, supplier and total already filed: don't file it twice.
    const same = (await call(env, store, realmId, 'GET', `/expenses?from_date=${date}&to_date=${date}`)).expenses || [];
    const dup = same.find(e => Math.abs(Math.abs(Number(e.gross_value)) - total) < 0.005 && String(e.description || '').toLowerCase().startsWith(supplier.toLowerCase().slice(0, 20)));
    if (dup) return { ok: true, duplicate: true, id: idOf(dup.url) };
    const cat = pickCategory(await categories(env, store, realmId), r.category);
    if (!cat) throw new Error('No expense categories found in FreeAgent');
    const reg = await registered(store, realmId, t);
    const net = round2(total - vat), rate = reg && vat > 0 && net > 0 ? Math.round((vat / net) * 100) : 0;
    const expense = {
      user: t.fa_user, category: cat.url, dated_on: date, gross_value: String(-total), description: `${supplier}${r.items ? ' - ' + r.items : ''}`.slice(0, 250),
      ...(reg ? { sales_tax_rate: String(rate) } : {}),
    };
    let attached = false;
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(r.image || '');
    if (m) { expense.attachment = { data: m[2], file_name: `receipt.${m[1].split('/')[1].replace('jpeg', 'jpg')}`, content_type: m[1], description: 'Added from a receipt photo' }; attached = true; }
    const created = (await call(env, store, realmId, 'POST', '/expenses', { expense })).expense;
    const id = idOf(created.url);
    await D.logChange(store, realmId, { kind: 'file', ref: id, text: `Filed ${r.supplier || 'an expense'} ${D.money(total)} (${cat.description})` });
    return { ok: true, id, total, account: cat.description, vatCode: reg ? `${rate}%` : 'none', attached };
  }

  async function undo(env, store, realmId, id) {
    const log = await store.fetch(`https://store/log/${realmId}`).then(r => r.json()).catch(() => []);
    if (!log.some(e => e.kind === 'file' && String(e.ref) === String(id) && !e.undone)) throw new Error('Only expenses added from the app can be undone here');
    await call(env, store, realmId, 'DELETE', `/expenses/${id}`);
    await D.markUndone(store, realmId, 'file', id);
    return { ok: true };
  }

  async function contactNames(env, store, realmId) {
    const d = await call(env, store, realmId, 'GET', '/contacts?per_page=100&view=all');
    return Object.fromEntries((d.contacts || []).map(c => [c.url, c.organisation_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Customer']));
  }
  async function owed(env, store, realmId) {
    const [inv, names] = await Promise.all([call(env, store, realmId, 'GET', '/invoices?view=open_or_overdue&per_page=100'), contactNames(env, store, realmId)]);
    const today = Date.now();
    return (inv.invoices || []).map(i => ({
      id: idOf(i.url), number: i.reference || '', customer: names[i.contact] || 'Customer', date: i.dated_on, due: i.due_on || i.dated_on,
      total: Number(i.total_value), balance: Number(i.due_value), email: '', cis: 0,
      daysOverdue: Math.max(0, Math.floor((today - Date.parse(i.due_on || i.dated_on)) / 86400000)),
    })).sort((a, b) => b.daysOverdue - a.daysOverdue);
  }
  async function summary(env, store, realmId, month, TAX_POT) {
    const m = /^\d{4}-\d{2}$/.test(month || '') ? month : D.ukToday().slice(0, 7);
    const [y, mo] = m.split('-').map(Number), end = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
    const d = (await call(env, store, realmId, 'GET', `/accounting/profit_and_loss/summary?from_date=${m}-01&to_date=${end}`)).profit_and_loss_summary || {};
    const moneyIn = round2(d.income), moneyOut = round2(d.expenses), profit = round2(d.operating_profit != null ? d.operating_profit : moneyIn - moneyOut);
    const inv = await owed(env, store, realmId);
    return { month: m, moneyIn, moneyOut, profit, owed: round2(inv.reduce((s, i) => s + i.balance, 0)), owedCount: inv.length, taxPot: round2(Math.max(0, profit) * TAX_POT) };
  }
  async function recent(env, store, realmId) {
    const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const list = ((await call(env, store, realmId, 'GET', `/expenses?from_date=${from}&per_page=100`)).expenses || [])
      .sort((a, b) => String(b.dated_on).localeCompare(String(a.dated_on))).slice(0, 10);
    return list.map(e => ({ id: idOf(e.url), date: e.dated_on, total: Math.abs(Number(e.gross_value)), supplier: String(e.description || '').split(' - ')[0], jobId: '', job: '' }));
  }

  // Monthly books-check input: spending in the last 90 days with no receipt attached.
  async function noReceipt(env, store, realmId) {
    const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const list = (await call(env, store, realmId, 'GET', `/expenses?from_date=${from}&per_page=100`)).expenses || [];
    return list.filter(e => !e.attachment && Number(e.gross_value) < 0)
      .map(e => ({ id: idOf(e.url), date: e.dated_on, supplier: String(e.description || '').split(' - ')[0], total: Math.abs(Number(e.gross_value)), account: '' }));
  }

  async function newInvoice(env, store, realmId, r, sendAllowed) {
    const t = await token(env, store, realmId);
    const amount = r.cis ? round2((Number(r.labour) || 0) + (Number(r.materials) || 0)) : round2(r.amount);
    if (!(amount > 0)) throw new Error('Put in an amount');
    const name = (r.customer || '').trim().slice(0, 100);
    if (!name) throw new Error('Put in the customer\'s name');
    const email = (r.email || '').trim();
    const names = await contactNames(env, store, realmId);
    let contact = Object.keys(names).find(u => names[u].toLowerCase() === name.toLowerCase());
    if (!contact) contact = (await call(env, store, realmId, 'POST', '/contacts', { contact: { organisation_name: name, ...(email ? { email } : {}) } })).contact.url;
    const reg = await registered(store, realmId, t);
    const kinds = { standard: 20, reduced: 5, zero: 0, none: 0 };
    const rate = reg ? (kinds[r.vatRate] != null ? kinds[r.vatRate] : r.vat ? 20 : 0) : 0;
    const taxField = reg ? { sales_tax_rate: String(rate) } : {};
    const items = r.cis
      ? [{ description: `${r.description || 'Labour'} (labour)`, item_type: 'Services', quantity: '1', price: String(round2(r.labour)), ...taxField }, ...(round2(r.materials) > 0 ? [{ description: 'Materials', item_type: 'Services', quantity: '1', price: String(round2(r.materials)), ...taxField }] : [])]
      : [{ description: String(r.description || 'Work done').slice(0, 250), item_type: 'Services', quantity: '1', price: String(amount), ...taxField }];
    const cisDeduction = r.cis ? round2((Number(r.labour) || 0) * 0.2) : 0;
    const invoice = (await call(env, store, realmId, 'POST', '/invoices', { invoice: { contact, dated_on: D.ukToday(), payment_terms_in_days: 14, invoice_items: items, ...(r.cis ? { comments: `CIS job. Expected deduction £${cisDeduction.toFixed(2)}` } : {}) } })).invoice;
    const id = idOf(invoice.url);
    let sentTo = '';
    if (!(email && sendAllowed)) await call(env, store, realmId, 'PUT', `/invoices/${id}/transitions/mark_as_sent`);
    if (email && sendAllowed) {
      await call(env, store, realmId, 'POST', `/invoices/${id}/send_email`, { invoice: { email: { to: email, subject: `Invoice ${invoice.reference || ''}`.trim(), body: `Hi, please find your invoice${invoice.reference ? ' ' + invoice.reference : ''} attached. Thank you.` } } });
      sentTo = email;
    }
    const total = Number(invoice.total_value) || round2(amount * (1 + rate / 100));
    await D.logChange(store, realmId, { kind: 'invoice', ref: id, text: `Invoice ${invoice.reference || ''} for ${r.customer} ${D.money(total)}${sentTo ? `, emailed to ${sentTo}` : ''}`.trim() });
    return { ok: true, id, number: invoice.reference || '', total, sentTo, cisDeduction, toReceive: round2(total - cisDeduction) };
  }

  async function status(env, store, realmId) {
    const t = await saved(store, realmId);
    try {
      const c = (await call(env, store, realmId, 'GET', '/company')).company;
      return { connected: true, company: c.name, sandbox: (t && t.env) !== 'production', since: t && t.saved_at, software: SOFTWARE };
    } catch (err) { return { connected: false, problem: String(err.message).slice(0, 120), software: SOFTWARE }; }
  }

  // Read-write check of a new connection that cleans up after itself: every entry is named TEST and deleted at the end.
  async function selftest(env, store, realmId) {
    const steps = [], step = async (name, fn) => { try { const note = await fn(); steps.push({ name, ok: true, note: note || '' }); return true; } catch (e) { steps.push({ name, ok: false, note: String(e.message).slice(0, 160) }); return false; } };
    const made = { expense: null, invoice: null, contact: null };
    try {
      await step('Connected to FreeAgent', async () => { const s = await status(env, store, realmId); if (!s.connected) throw new Error(s.problem); return s.sandbox ? 'sandbox' : 'live'; });
      await step('Reads expense categories', async () => { const c = await categories(env, store, realmId); if (!c.length) throw new Error('none found'); return `${c.length} found`; });
      await step('Reads figures and who owes you', async () => { await summary(env, store, realmId, null, 0.25); await recent(env, store, realmId); return 'ok'; });
      await step('Files a test receipt', async () => {
        const r = await fileReceipt(env, store, realmId, { supplier: 'TEST Books connection (delete me)', total: 1.2, vat: 0.2, category: 'Fuel', items: 'connection test' });
        if (!r.ok || r.duplicate) throw new Error('not created'); made.expense = r.id; return `${r.account}, VAT ${r.vatCode}`;
      });
      await step('Test receipt can be found', async () => { const today = D.ukToday(); const l = (await call(env, store, realmId, 'GET', `/expenses?from_date=${today}&to_date=${today}`)).expenses || []; if (!l.some(e => idOf(e.url) === String(made.expense))) throw new Error('not found'); });
      await step('Undo removes the test receipt', async () => { await undo(env, store, realmId, made.expense); made.expense = null; });
      await step('Creates a test invoice that counts as owed', async () => {
        const r = await newInvoice(env, store, realmId, { customer: 'TEST Books connection (delete me)', description: 'connection test', amount: 1 }, false);
        made.invoice = r.id;
        const o = await owed(env, store, realmId); if (!o.some(i => i.id === String(r.id))) throw new Error('not in who-owes-you');
        return `total ${r.total}`;
      });
    } finally {
      // Clean up whatever was made, whatever happened.
      await step('Cleans up the test invoice', async () => { if (!made.invoice) return 'none made'; await call(env, store, realmId, 'PUT', `/invoices/${made.invoice}/transitions/mark_as_draft`).catch(() => {}); await call(env, store, realmId, 'DELETE', `/invoices/${made.invoice}`); });
      await step('Cleans up the test customer', async () => { const names = await contactNames(env, store, realmId); const u = Object.keys(names).find(k => names[k].startsWith('TEST Books connection')); if (u) await call(env, store, realmId, 'DELETE', `/contacts/${idOf(u)}`); return u ? 'removed' : 'none'; });
      await step('Cleans up any leftover test receipt', async () => { if (made.expense) await call(env, store, realmId, 'DELETE', `/expenses/${made.expense}`); });
    }
    return { ok: steps.every(s => s.ok), steps };
  }

  return { call, token, selftest, fileReceipt, undo, owed, summary, recent, newInvoice, status, categories, registered, untidy: async () => [], noReceipt };
}
