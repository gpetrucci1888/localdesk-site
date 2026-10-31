// Stripe payments for Localdesk: signed webhooks keep the founding places honest, and a checkout link can be made for a lead.
// Nothing here runs until the owner sets the secrets in Cloudflare: STRIPE_WEBHOOK_SECRET (the webhook's signing secret) and
// STRIPE_SECRET_KEY (a RESTRICTED key that can only write Checkout Sessions), plus the four price ids below. With any of them
// missing, the webhook and the checkout both refuse (fail closed) and no call to Stripe is made. No prices exist in Stripe yet.
//   STRIPE_PRICE_RECEPTIONIST (397 pounds monthly)   STRIPE_PRICE_RECEPTIONIST_SETUP (497 pounds one-off)
//   STRIPE_PRICE_BOOKS (150 pounds monthly)          STRIPE_PRICE_BOOKS_SETUP (395 pounds one-off)
// A founding Receptionist client is charged the monthly price only (7-day trial) and takes one of five places. Everyone else pays
// the monthly price plus the setup fee. Books never gets the waiver. A place is reserved when the owner ticks it on the lead, becomes
// theirs when the subscription starts, and comes back if they cancel within 7 days (an owner decision proposed in docs/FOUNDING-RESERVATION-DESIGN.md).
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const TOLERANCE_S = 300;

export async function verifyStripeSignature(secret, rawBody, header, nowMs = Date.now()) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(String(header).split(',').map(x => x.trim().split('=')).filter(x => x.length === 2).map(([k, v]) => [k, v]));
  const t = Number(parts.t), v1 = String(header).split(',').map(x => x.trim()).filter(x => x.startsWith('v1=')).map(x => x.slice(3));
  if (!Number.isFinite(t) || !v1.length || Math.abs(nowMs / 1000 - t) > TOLERANCE_S) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${rawBody}`)));
  return v1.some(sig => { if (sig.length !== mac.length) return false; let d = 0; for (let i = 0; i < mac.length; i++) d |= mac.charCodeAt(i) ^ sig.charCodeAt(i); return d === 0; });
}

// What a subscription event means for the founding places.
export async function handleEvent(event, { store, foundingOp, now = Date.now() }) {
  const first = await (await store.fetch('https://store/once', { method: 'POST', body: JSON.stringify({ key: `stripe:${event.id}` }) })).json();
  if (!first.first) return { ignored: 'event already handled' };
  if (!['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) return { ignored: 'event type not used' };
  const sub = event.data && event.data.object || {}, md = sub.metadata || {};
  if (md.product !== 'receptionist' || md.founding !== 'true' || !/^[\w-]{1,40}$/.test(md.lead_id || '')) return { ignored: 'not a founding Receptionist subscription' };
  const live = ['trialing', 'active'].includes(sub.status) && event.type !== 'customer.subscription.deleted';
  const gone = event.type === 'customer.subscription.deleted' || ['canceled', 'incomplete_expired'].includes(sub.status);
  if (live) { const r = await foundingOp(store, 'activate', md.lead_id, { sub: sub.id, now }); return r.over ? { flagged: 'all five places were already used', lead: md.lead_id } : { activated: md.lead_id }; }
  if (gone) { const r = await foundingOp(store, 'cancel', md.lead_id, { sub: sub.id, now }); return { cancelled: md.lead_id, released: !!r.released }; }
  return { ignored: `status ${sub.status} changes nothing` };
}

export async function stripeWebhook(request, env, deps) {
  if (!env.STRIPE_WEBHOOK_SECRET) return new Response('Stripe is not set up', { status: 503 });
  const raw = await request.text();
  if (raw.length > 512 * 1024) return new Response('Too large', { status: 413 });
  if (!(await verifyStripeSignature(env.STRIPE_WEBHOOK_SECRET, raw, request.headers.get('Stripe-Signature')))) return new Response('Bad signature', { status: 400 });
  let event; try { event = JSON.parse(raw); } catch { return new Response('Bad json', { status: 400 }); }
  if (!event || typeof event.id !== 'string' || typeof event.type !== 'string') return new Response('Bad event', { status: 400 });
  return Response.json(await handleEvent(event, deps)); // an error here becomes a 500, so Stripe retries the event
}

const PRICE = { receptionist: ['STRIPE_PRICE_RECEPTIONIST', 'STRIPE_PRICE_RECEPTIONIST_SETUP'], books: ['STRIPE_PRICE_BOOKS', 'STRIPE_PRICE_BOOKS_SETUP'] };
export function checkoutParams(env, lead, founding) {
  const [monthly, setup] = PRICE[lead.product] || [];
  if (!monthly) throw new Error('Checkout is for Receptionist or Books leads only');
  const p = new URLSearchParams(), items = [env[monthly]];
  if (!founding) items.push(env[setup]);
  items.forEach((price, i) => { p.set(`line_items[${i}][price]`, price); p.set(`line_items[${i}][quantity]`, '1'); });
  p.set('mode', 'subscription'); p.set('client_reference_id', lead.id);
  p.set('success_url', env.CHECKOUT_SUCCESS_URL || 'https://www.localdeskai.co.uk/thanks.html'); p.set('cancel_url', env.CHECKOUT_CANCEL_URL || 'https://localdeskai.co.uk/');
  for (const [k, v] of Object.entries({ lead_id: lead.id, product: lead.product, founding: String(!!founding) })) { p.set(`subscription_data[metadata][${k}]`, v); p.set(`metadata[${k}]`, v); }
  if (lead.product === 'receptionist') p.set('subscription_data[trial_period_days]', '7');
  return p;
}

// Makes a checkout link for the owner to look at and send himself. Nothing is ever sent to the customer from here.
export async function createCheckout(env, store, leadId, { foundingOp }) {
  const need = ['STRIPE_SECRET_KEY'];
  const lead = await (await store.fetch(`https://store/lead/${encodeURIComponent(leadId)}`)).json().catch(() => null);
  if (!lead || !lead.id) return { status: 404, error: 'No such lead' };
  if (!PRICE[lead.product]) return { status: 400, error: 'Checkout is for Receptionist or Books leads only. Set what they are interested in first.' };
  const [monthly, setup] = PRICE[lead.product];
  const missing = [...need, monthly, setup].filter(k => !env[k]);
  if (missing.length) return { status: 503, error: `Stripe is not set up yet. Missing in Cloudflare: ${missing.join(', ')}` };
  let founding = false;
  if (lead.product === 'receptionist' && lead.checklist && lead.checklist.founding === true) { // the owner ticked the waiver: confirm the place is really still held
    const r = await foundingOp(store, 'claim', lead.id);
    if (!r.ok) return { status: 409, error: 'All five founding places are taken, so the setup fee applies. Untick the founding waiver on the lead.' };
    founding = true;
  }
  const params = checkoutParams(env, lead, founding);
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `checkout-${lead.id}-${lead.product}-${founding}-${new Date().toISOString().slice(0, 13)}` }, body: params });
  if (!res.ok) return { status: 502, error: `Stripe refused to make the link (status ${res.status})` };
  const s = await res.json();
  return { status: 200, url: s.url, founding, setupFee: !founding, trialDays: lead.product === 'receptionist' ? 7 : 0 };
}
