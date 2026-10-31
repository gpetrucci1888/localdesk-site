// Sales pipeline pages for HQ: website enquiries become leads that move new -> contacted -> demo -> trial -> onboarding -> paying.
// Nothing here sends a message. Drafts are text for Gio to edit; the buttons open his own phone's apps and he presses send.
import { shell, esc, banner, btn, pill, item, crumb, tile } from './ui.js';

export const STAGES = [['new', 'New enquiry'], ['contacted', 'Called or contacted'], ['interested', 'Interested'], ['zoom', 'Zoom booked'], ['demo', 'Demo attended'], ['trial', 'Follow-up or trial'], ['onboarding', 'Signed up, onboarding'], ['paying', 'Paying']];
export const LABEL = { ...Object.fromEntries(STAGES), lost: 'Lost' };
const ORDER = STAGES.map(s => s[0]);
const PRODUCT = { receptionist: 'Receptionist', books: 'Books', unsure: 'Not sure yet' };
const KIND = { new: 'warn', contacted: 'mute', interested: 'mute', zoom: 'mute', demo: 'mute', trial: 'mute', onboarding: 'mute', paying: 'ok', lost: 'mute' };

// Same rules as the Books connector, so HQ only offers moves that will be accepted.
export function moves(from) {
  if (from === 'lost') return ['new', 'contacted'];
  const a = ORDER.indexOf(from), out = [];
  for (let b = 0; b < ORDER.length; b++) if (b !== a && (b > a || b === a - 1) && !(ORDER[b] === 'paying' && from !== 'onboarding')) out.push(ORDER[b]);
  return [...out, 'lost'];
}

export const CHECKLISTS = {
  receptionist: [['demo_done', 'Demo done'], ['trial_agreed', '7-day free trial agreed'], ['forwarding', 'Call forwarding set up on their phone'], ['assistant', 'Their receptionist built, and approved by them'], ['payment', 'Payment details taken on the day it goes live (Stripe link)'], ['founding', 'Founding-client setup waiver applied (only the first 5 Receptionist clients; HQ blocks a sixth)'], ['live', 'Live, and a test call made']],
  books: [['demo_done', 'Demo done'], ['agreement', 'Agreement signed'], ['id_check', 'Identity check done and recorded in your own files'], ['payment', 'Setup fee paid and subscription set up (Stripe link)'], ['software', 'Their accounting software chosen (QuickBooks, FreeAgent or Xero; they hold their own subscription)'], ['invited', 'Connect link made and sent (button below)'], ['connected', 'They connected, and you ran the accounting setup check'], ['first_receipt', 'First test receipt filed, and they have seen Undo'], ['accountant', 'Their accountant\'s email added in Settings'], ['terms', 'They ticked the terms in the app']],
  unsure: [['demo_done', 'Demo done'], ['chosen', 'They have chosen Receptionist, Books or both (then pick it above)']],
};
const listFor = (l) => CHECKLISTS[l.product] || CHECKLISTS.unsure;

export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
// Zoom demos booked for today or tomorrow (London time). Leads marked lost, paying or do-not-call are left out.
export const zoomsSoon = (leads, now = Date.now()) => {
  const day = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Europe/London' }), t0 = day(now), t1 = day(now + 86400000);
  return (leads || []).filter(l => l.meeting_at && !l.dnc && !['lost', 'paying'].includes(l.status) && [t0, t1].includes(String(l.meeting_at).slice(0, 10)))
    .map(l => ({ lead: l, when: String(l.meeting_at).slice(0, 10) === t0 ? 'today' : 'tomorrow', time: String(l.meeting_at).slice(11, 16) }))
    .sort((x, y) => String(x.lead.meeting_at).localeCompare(String(y.lead.meeting_at)));
};
export const isDue = (l) => Boolean(l.next_at) && l.next_at <= today() && l.status !== 'paying' && l.status !== 'lost';
const first = (n) => String(n || '').trim().split(/\s+/)[0] || 'there';
const intl = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('00') ? d.slice(2) : d.startsWith('44') ? d : d.startsWith('0') ? '44' + d.slice(1) : d; };
const ago = (ts) => { const d = Math.floor((Date.now() - ts) / 86400000); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };
const dayStr = (s) => s ? new Date(s + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'none set';

// An editable starting point for what Gio says next. Never sent automatically.
export function draftFor(l) {
  const n = first(l.name), p = l.product === 'receptionist' ? 'the Receptionist' : l.product === 'books' ? 'Books' : 'Localdesk';
  const T = {
    new: `Hi ${n}, it's Gio from Localdesk in Saltash. Thanks for getting in touch about ${p}. Is now a good time for a quick chat, or shall I ring you later?`,
    contacted: `Hi ${n}, Gio from Localdesk here. Just checking you got my message about ${p}. Happy to show you a 15-minute demo whenever suits you.`,
    interested: `Hi ${n}, Gio from Localdesk. As we discussed, I'd be happy to show you ${p} in a 15 to 20 minute Zoom. Tell me a time that suits and I'll send the link.`,
    zoom: `Hi ${n}, Gio from Localdesk. Just confirming our Zoom${l.meeting_at ? ' on ' + String(l.meeting_at).replace('T', ' at ') : ''}. ${l.meeting_link ? 'The link is ' + l.meeting_link + '. ' : ''}See you then.`,
    demo: l.product === 'books'
      ? `Hi ${n}, thanks for your time today. If you'd like to go ahead with Books, the next steps are a short agreement, then I connect it to your accounting software. No pressure, ring me with any questions.`
      : `Hi ${n}, thanks for your time today. If you'd like to try the Receptionist, there's a 7-day free trial on your own phone. I set it up first and you decide after. Shall I get started?`,
    trial: `Hi ${n}, Gio from Localdesk. How is it going so far? Anything you'd like changed, or anything not working the way you expected?`,
    onboarding: `Hi ${n}, to get you set up the next step is on the checklist I've got for you. Tell me a good time this week and I'll walk you through it.`,
    paying: `Hi ${n}, welcome aboard. Ring or text me any time if something isn't right.`,
    lost: '',
  };
  return T[l.status] || '';
}

// Which Localdesk product is a subscription? Only by IDs we can verify: a price ID listed in STRIPE_PRICES_BOOKS or
// STRIPE_PRICES_RECEPTIONIST (comma separated), or the Stripe product's metadata localdesk_product = books | receptionist.
// A name such as "Books" in a price nickname proves nothing, so anything else stays unclassified and is never counted.
export const priceConfig = (env) => { const set = (v) => new Set(String(v || '').split(',').map(x => x.trim()).filter(Boolean)); return { books: set(env.STRIPE_PRICES_BOOKS), receptionist: set(env.STRIPE_PRICES_RECEPTIONIST) }; };
export function classifyProduct(price, cfg) {
  const p = price || {}, inBooks = cfg.books.has(p.id), inMia = cfg.receptionist.has(p.id);
  if (inBooks !== inMia) return inBooks ? 'books' : 'receptionist';
  if (inBooks && inMia) return null;   // listed under both: ambiguous, so unclassified
  const meta = (p.product && typeof p.product === 'object' && p.product.metadata && p.product.metadata.localdesk_product) || (p.metadata && p.metadata.localdesk_product) || '';
  return meta === 'books' || meta === 'receptionist' ? meta : null;
}
// What a Stripe subscription is, from ALL its recurring items (a one-off setup price is ignored). The product is known only when
// every recurring item is the same verified product and priced in pounds; mixed, unverified or odd-interval items stay unclassified.
export function subscriptionFacts(s, cfg) {
  const items = ((s.items && s.items.data) || []).filter(i => i && i.price && i.price.recurring);
  const monthly = (price, qty) => {
    const r = price.recurring, n = Number(r.interval_count) || 1, amt = (Number(price.unit_amount) || 0) * (Number(qty) || 1) / 100;
    return r.interval === 'month' ? amt / n : r.interval === 'year' ? amt / (12 * n) : NaN;
  };
  const per = items.reduce((t, i) => t + monthly(i.price, i.quantity), 0);
  const kinds = new Set(items.map(i => (i.price.currency && i.price.currency !== 'gbp') ? null : classifyProduct(i.price, cfg)));
  const product = items.length && kinds.size === 1 && !kinds.has(null) ? [...kinds][0] : null;
  return { per: Number.isFinite(per) ? per : 0, product: Number.isFinite(per) ? product : null, priceId: items.map(i => i.price.id).filter(Boolean).join(' + '), plan: items.map(i => i.price.nickname).filter(Boolean).join(' + ') || 'Subscription' };
}
// "Paying" means: a classified Localdesk subscription that is active, costs money, AND whose latest invoice Stripe says is paid.
// Active but latest invoice open or unknown is shown separately, never as paying. MRR is the monthly price of the paying ones only.
export function progress(subList) {
  const mine = subList.filter(s => s.product), isLive = (s) => s.status === 'active' && s.per > 0;
  const paid = mine.filter(s => isLive(s) && s.invoicePaid === true);
  const unconfirmed = mine.filter(s => isLive(s) && s.invoicePaid !== true);
  const trial = mine.filter(s => s.status === 'trialing');
  const atRisk = mine.filter(s => ['past_due', 'unpaid'].includes(s.status));
  const unclassified = subList.filter(s => !s.product && ['active', 'trialing', 'past_due', 'unpaid'].includes(s.status));
  return { paid, trial, atRisk, unconfirmed, unclassified, books: paid.filter(s => s.product === 'books').length, receptionist: paid.filter(s => s.product === 'receptionist').length, mrr: paid.reduce((n, x) => n + x.per, 0), target: 20 };
}
const bar = (label, n, target) => `<div><p><b>${esc(label)}</b><span>${n} of ${target} paying${n >= target ? ', target reached' : `, ${target - n} to go`}</span></p><div class="bar" role="progressbar" aria-label="${esc(label)}" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="${target}"><i style="width:${Math.min(100, Math.round(n / target * 100))}%"></i></div></div>`;
export const progressCard = (pr, stripeOk) => `<div class="card"><h2>Road to ${pr.target} paying customers each</h2>${stripeOk ? `<div class="prog">${bar('Receptionist', pr.receptionist, pr.target)}${bar('Books', pr.books, pr.target)}</div><p class="mute">Paying means an active Localdesk subscription whose latest invoice Stripe shows as paid. Not counted: ${pr.trial.length} on trial, ${pr.atRisk.length} with a failed payment, ${pr.unconfirmed.length} active but not yet paid, ${pr.unclassified.length} not matched to Receptionist or Books.</p>${pr.unclassified.length ? `<p class="mute"><b>Not matched to a product:</b> ${pr.unclassified.map(s => `${esc(s.who)} (price ${esc(s.priceId || 'unknown')})`).join(', ')}. To count them, add that price ID to STRIPE_PRICES_BOOKS or STRIPE_PRICES_RECEPTIONIST on the HQ worker, or set the Stripe product's metadata localdesk_product.</p>` : ''}` : '<p class="mute">Connect Stripe to see this. Only paid, active Localdesk subscriptions count.</p>'}</div>`;

const leadRow = (l) => item(`/leads/${esc(l.id)}`, l.name || 'Lead', `${esc(PRODUCT[l.product] || '')}${l.business ? ' · ' + esc(l.business) : ''} · ${ago(l.created)}${l.repeat > 1 ? ` · asked ${l.repeat} times` : ''}${l.next_at && l.status !== 'paying' && l.status !== 'lost' ? ` · follow up ${esc(dayStr(l.next_at))}` : ''}`, isDue(l) ? pill('bad', 'Follow up') : pill(KIND[l.status], LABEL[l.status]));

const sourceCard = (leads) => { const by = {}; for (const l of leads) { const k = l.source || 'website'; by[k] = (by[k] || 0) + 1; } const rows = Object.entries(by).sort((a, b) => b[1] - a[1]);
  return rows.length > 1 || (rows[0] && rows[0][0] !== 'website') ? `<div class="card"><h2>Where leads come from</h2><div class="list">${rows.map(([k, n]) => `<div class="item"><span class="body"><b>${esc(k)}</b></span><b>${n}</b></div>`).join('')}</div><p class="mute">Add <code>?utm_source=facebook</code> (or google, flyer and so on) to a link you share and enquiries from it are counted here.</p></div>` : ''; };
export function pageLeads(leads, pr, stripeOk, flash = '', founding = null) {
  const open = leads.filter(l => l.status !== 'lost'), lost = leads.filter(l => l.status === 'lost');
  const due = open.filter(l => l.status === 'new' || isDue(l));
  const groups = STAGES.filter(([k]) => k !== 'paying').map(([k, t]) => [t, open.filter(l => l.status === k)]).filter(([, a]) => a.length);
  const payingLeads = open.filter(l => l.status === 'paying');
  return shell('Leads', `<div class="ph"><div><h1>Leads</h1><p class="lead">Website enquiries and people you've spoken to, from first message to paying customer. Nothing is ever sent to them automatically.</p></div></div>${flash}
<div class="tiles">${tile(leads.filter(l => l.status === 'new').length, 'new enquiries', false, true)}${tile(due.length, 'to follow up')}${tile(open.filter(l => !['new', 'paying'].includes(l.status)).length, 'in the pipeline')}${tile(founding === null ? 'unknown' : `${founding} of 5`, 'founding places reserved')}</div>
<section class="section"><div class="qa">${btn('/leads/new', 'Add a lead')}</div></section>
${due.length ? `<div class="card"><h2>Needs a follow-up</h2><div class="list">${due.map(leadRow).join('')}</div></div>` : ''}
${groups.map(([t, a]) => `<div class="card"><h2>${esc(t)} (${a.length})</h2><div class="list">${a.map(leadRow).join('')}</div></div>`).join('')}
${payingLeads.length ? `<div class="card"><h2>Marked as paying (${payingLeads.length})</h2><div class="list">${payingLeads.map(leadRow).join('')}</div><p class="mute">The figures below come from Stripe, not from this list.</p></div>` : ''}
${!open.length ? '<div class="card"><p class="mute">No leads yet. Website enquiries appear here the moment they arrive. Nothing is ever sent to them automatically.</p></div>' : ''}
${sourceCard(leads)}
${progressCard(pr, stripeOk)}
${lost.length ? `<div class="card"><h2>Lost (${lost.length})</h2><div class="list">${lost.map(leadRow).join('')}</div></div>` : ''}`, '/leads');
}

export const newLeadForm = (msg = '', v = {}) => shell('Add a lead', `${crumb('/leads', 'Leads')}<h1>Add a lead</h1><p class="lead">For someone you met or spoke to. Nothing is sent to them.</p>${msg ? banner('bad', msg) : ''}
<div class="card"><form method="post" action="/leads/new">
<label for="n">Name</label><input id="n" name="name" value="${esc(v.name || '')}" required>
<label for="p">Mobile number</label><input id="p" name="phone" inputmode="tel" value="${esc(v.phone || '')}" placeholder="07700 900123" required>
<label for="b">Business (if they have one)</label><input id="b" name="business" value="${esc(v.business || '')}">
<label for="pr">Interested in</label><select id="pr" name="product"><option value="receptionist"${v.product === 'receptionist' ? ' selected' : ''}>Receptionist</option><option value="books"${v.product === 'books' ? ' selected' : ''}>Books</option><option value="unsure"${!v.product || v.product === 'unsure' ? ' selected' : ''}>Not sure yet</option></select>
<label for="s">Where from</label><input id="s" name="source" value="${esc(v.source || 'phone call')}" maxlength="20">
<label for="m">What they said</label><input id="m" name="message" value="${esc(v.message || '')}" maxlength="600">
<div class="sp"></div><button class="btn block">Add lead</button></form></div>`, '/leads');

// A Books lead is matched to their connected app by the last 10 digits of their mobile. Connection, software and first receipt are then read from the app itself, not ticked by hand.
const SOFT = { quickbooks: 'QuickBooks', freeagent: 'FreeAgent', xero: 'Xero' };
export const appFor = (l, clients) => (l.product === 'books' && l.phoneKey && Array.isArray(clients) ? clients.find(c => c.phoneKey && c.phoneKey === l.phoneKey) || null : null);
export const effectiveChecks = (l, app) => ({ ...(l.checklist || {}), ...(app ? { software: true, invited: true, connected: app.ok === true, ...(app.everFiled ? { first_receipt: true } : {}) } : {}) });
export const nextStep = (l, checks) => { const t = listFor(l).find(([k]) => !checks[k]); return t ? t[1] : null; };
const appCard = (l, app, problem) => l.product !== 'books' || l.status === 'lost' ? '' : !app
  ? `<div class="card"><h2>Their app</h2><p class="mute">Not connected yet. Once they use the connect link and it works, this shows the software they chose, whether it is connected and whether a first receipt has been filed.</p></div>`
  : `<div class="card"><h2>Their app</h2><div class="list">${item(`/books/client/${esc(app.realmId)}`, esc(SOFT[app.platform] || 'Accounting software'), app.ok ? 'Connected and working' : esc(problem || 'Not working: they may need a fresh connect link'), app.ok ? pill('ok', 'Connected') : pill('bad', 'Needs attention'))}</div><p class="mute">${app.ok ? (app.everFiled ? 'A receipt has been filed.' : 'No receipt filed yet. Ask them to photograph one so you can check it lands in their software.') : 'Open their page to reconnect or see what went wrong.'}${app.seenDays != null ? ` Last used ${app.seenDays === 0 ? 'today' : app.seenDays + ' day' + (app.seenDays === 1 ? '' : 's') + ' ago'}.` : ''}</p></div>`;
export function pageLead(l, { template = false, flash = '', app = null, problem = '' } = {}) {
  const checks = effectiveChecks(l, app), list = listFor(l), done = list.filter(([k]) => checks[k]).length, mv = moves(l.status), next = l.status === 'lost' || l.status === 'paying' ? null : nextStep(l, checks);
  const draft = template || !l.draft ? draftFor(l) : l.draft, num = intl(l.phone);
  const forward = mv.filter(s => s !== 'lost' && ORDER.indexOf(s) > ORDER.indexOf(l.status)), back = mv.filter(s => s !== 'lost' && !forward.includes(s));
  const moveBtn = (s, cls = 'line') => `<button class="btn ${cls}" name="status" value="${s}">${s === 'lost' ? 'Mark as lost' : (back.includes(s) || l.status === 'lost' ? 'Reopen as ' : 'Move to ') + esc(LABEL[s])}</button>`;
  const blockedCall = Boolean(l.dnc) || l.tps === 'registered', coldCalled = !(l.messages || []).length && l.source !== 'website';
  const connect = `/books/new?name=${encodeURIComponent(l.business || l.name)}&phone=${encodeURIComponent(l.phone)}`;
  return shell(l.name || 'Lead', `${crumb('/leads', 'Leads')}${flash}<div class="ph"><div><h1>${esc(l.name || 'Lead')}</h1><p class="lead">${esc(PRODUCT[l.product] || '')}${l.business ? ' · ' + esc(l.business) : ''} · from ${esc(l.source || 'website')} ${ago(l.created)}</p></div>${pill(KIND[l.status], LABEL[l.status])}</div>
${next ? banner('info', `Next step: ${next}`) : ''}${appCard(l, app, problem)}${['receptionist', 'books'].includes(l.product) && l.status !== 'lost' ? `<div class="card"><h2>Payment link</h2><p class="mute">Makes a Stripe checkout link for ${esc(PRODUCT[l.product] || 'this product')}${l.product === 'receptionist' && l.checklist && l.checklist.founding ? ' (founding client: monthly price only, 7-day trial)' : ' (monthly price plus the setup fee)'}. It is only shown here. Nothing is sent to them: you copy it and send it yourself.</p><form method="post" action="/leads/${esc(l.id)}/checkout"><button class="btn line">Make a payment link</button></form></div>` : ''}<div class="card"><h2>Contact</h2><p><b>${esc(l.phone)}</b></p>${blockedCall ? banner('bad', 'Do not cold call this number', l.dnc ? 'You marked this lead do not call. No follow-up is scheduled.' : 'This number is registered with the TPS. Do not make a marketing call to it unless they have asked you to ring.') : `<div class="qa">${btn(`tel:${l.phone.replace(/[^\d+]/g, '')}`, 'Call', 'dark')}${l.meeting_link ? btn(l.meeting_link, 'Open the Zoom link', 'line', true) : ''}</div>`}
${(l.messages || []).length ? `<div class="sp"></div><h2>What they wrote</h2>${l.messages.map(m => `<p>${esc(m.text)}<br><small class="mute">${ago(m.at)}</small></p>`).join('')}` : ''}</div>
<div class="card"><h2>Where they are</h2><form method="post" action="/leads/${esc(l.id)}/save"><div class="stack">${forward.slice(0, 2).map((s, i) => moveBtn(s, i ? 'line' : 'dark')).join('')}${back.map(s => moveBtn(s)).join('')}${l.status === 'lost' ? mv.map(s => moveBtn(s)).join('') : moveBtn('lost')}</div></form>
<p class="mute">Next look: <b>${esc(dayStr(l.next_at))}</b>${isDue(l) ? ' (due now)' : ''}. ${l.status === 'onboarding' ? 'Counts as paying only once Stripe shows an active subscription.' : ''}</p></div>
<div class="card"><h2>Call plan</h2><form method="post" action="/leads/${esc(l.id)}/save"><input type="hidden" name="plan_form" value="1">
<label for="na">Next action</label><input id="na" name="next_action" maxlength="120" value="${esc(l.next_action || '')}" placeholder="e.g. Ring back Tuesday after 4pm">
<label for="ma">Zoom date and time</label><input id="ma" name="meeting_at" type="datetime-local" value="${esc(l.meeting_at || '')}">
<label for="ml">Zoom link (optional)</label><input id="ml" name="meeting_link" inputmode="url" maxlength="200" value="${esc(l.meeting_link || '')}" placeholder="https://zoom.us/j/...">
<label for="tp">TPS and CTPS check${l.tps_checked ? ` <small>(checked ${esc(l.tps_checked)})</small>` : ''}</label><select id="tp" name="tps"><option value=""${!l.tps ? ' selected' : ''}>Not checked yet</option><option value="clear"${l.tps === 'clear' ? ' selected' : ''}>Checked: not registered, OK to ring</option><option value="registered"${l.tps === 'registered' ? ' selected' : ''}>Registered: do not cold call</option></select>
<label class="ck"><input type="checkbox" name="dnc" value="1"${l.dnc ? ' checked' : ''}><span>They told me not to ring again (do not call)</span></label>
<p class="mute">${l.tps ? '' : 'Check the number against the TPS (and CTPS for companies) before you cold call. '}See docs/COLD-CALLING-COMPLIANCE.md.</p><div class="stack"><button class="btn dark">Save call plan</button></div></form></div>
<div class="card"><h2>Draft message</h2><p class="mute">Nothing is sent from here. The buttons open your own phone's apps with this text, and you press send. Edit it first.${coldCalled ? ' <b>You rang them, so only send a message if they agreed to hear from you that way.</b>' : ''}</p>
<form method="post" action="/leads/${esc(l.id)}/save"><label for="d">Message</label><textarea id="d" name="draft" rows="5" maxlength="1200">${esc(draft)}</textarea>
<label for="x">Follow up on</label><input id="x" name="next_at" type="date" value="${esc(l.next_at || '')}">
<label for="no">Your notes</label><textarea id="no" name="notes" rows="4" maxlength="3000">${esc(l.notes || '')}</textarea>
<div class="stack"><button class="btn dark">Save</button></div></form>
<div class="qa">${btn(`sms:+${num}?&body=${encodeURIComponent(draft)}`, 'Open in Messages')}${btn(`https://wa.me/${num}?text=${encodeURIComponent(draft)}`, 'Open in WhatsApp', 'line', true)}${btn(`/leads/${esc(l.id)}?template=1`, 'Reset to the template', 'line')}</div></div>
<div class="card"><h2>Onboarding checklist <small class="mute">${done} of ${list.length} done</small></h2><form method="post" action="/leads/${esc(l.id)}/save"><input type="hidden" name="checklist_form" value="1"><div class="cl">${list.map(([k, t]) => `<label class="ck"><input type="checkbox" name="ck_${k}" value="1"${checks[k] ? ' checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div><div class="stack"><button class="btn dark">Save checklist</button></div></form>
${l.product === 'books' ? `<div class="sp"></div>${btn(connect, 'Make the connect link')}<p class="mute">Opens the new-client form with their details filled in. Nothing is sent until you send the link yourself.</p>` : ''}</div>
<div class="card"><h2>History</h2>${(l.history || []).slice().reverse().map(h => `<p><b>${esc(LABEL[h.to])}</b> <small class="mute">${ago(h.at)}${h.from ? ' from ' + esc(LABEL[h.from]) : ''}</small></p>`).join('')}</div>
<div class="card"><h2>Delete this lead</h2><p class="mute">Removes their name and number for good. Use this if they ask you to.</p><form method="post" action="/leads/${esc(l.id)}/delete"><label class="ck"><input type="checkbox" name="confirm" value="yes" required><span>Yes, delete ${esc(first(l.name))}</span></label><div class="stack"><button class="btn line">Delete</button></div></form></div>`, '/leads');
}
