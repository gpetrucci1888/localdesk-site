# Stripe plan (plan only: nothing is created in Stripe until the owner approves each step)

## Products and prices to create (owner approves each in Stripe or says "create them")
| Product | Price | Type |
|---|---|---|
| Localdesk Receptionist | £397 | monthly subscription |
| Localdesk Receptionist setup | £497 | one-off (not charged for the first 5 founding clients) |
| Books by Localdesk | £150 | monthly subscription |
| Books setup | £395 | one-off, never waived |

Set Stripe product metadata `localdesk_product` to `receptionist` or `books`. HQ classifies by that metadata or by verified price IDs only (`STRIPE_PRICES_RECEPTIONIST`, `STRIPE_PRICES_BOOKS`).

## Connecting HQ (owner does this, no key in chat or GitHub)
1. In Stripe create a **restricted** key with read-only access to Customers, Subscriptions, Invoices, Charges.
2. In Cloudflare, hq worker, Variables and Secrets: add `STRIPE_KEY` (secret) and the two price-ID variables.
3. HQ then shows paying customers, failed payments and the road to 20 each. Paying means active, price above zero and latest invoice paid.

## Founding places
Today HQ counts a founding place from the "Founding setup waiver applied" tick on a Receptionist lead, refuses a sixth, and fails closed when it cannot check. Next step once Stripe is connected: count a place only when a Receptionist subscription exists with the setup price absent or waived, and show both numbers side by side so a mismatch is visible.

## Not built yet (needs the owner's go-ahead)
- Payment links or checkout, and any live price.
- Automatic provisioning after payment (Vapi assistant and Twilio number). Every Vapi or Twilio change needs owner approval, one change at a time.
