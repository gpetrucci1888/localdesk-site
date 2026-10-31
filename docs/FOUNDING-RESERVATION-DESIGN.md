# Founding places: what exists, and the proper Stripe-linked design

Answer to the review question: **a read-only Stripe key is not enough** for five-place reservation. It can show who has already subscribed, so it can report places used. It cannot stop two people taking the last place at the same moment, and it cannot hold a place for someone part-way through paying. Reservation has to be decided on our side, in one place that handles one request at a time, before the customer reaches Stripe.

## Built now (branch `stage1-founding`, not deployed)
- Places are reserved in the Books Store (a Durable Object, one request at a time). Claim is idempotent, a sixth claim fails, a lost lead, unticked waiver or deleted lead releases its place, and any error means no place (fail closed).
- Tests: eight simultaneous claims for five places give exactly five; ticks on leads and reserved places always agree; claiming twice is harmless; release on lost, untick and delete; a Store failure saves nothing.
- Limit: a place is reserved when the owner ticks the waiver on a lead, so it follows the owner's decision, not a payment.

## Proper design (not built, needs owner approval and Stripe setup)
1. **Reserve first.** The owner (or a checkout page) asks the Books worker to claim a place for a named lead. The Store records `reserved` with an expiry (for example 7 days, matching the free trial).
2. **Checkout without the setup fee.** Create a Stripe Checkout Session server-side with only the monthly price, and put the lead id and `founding: true` in session metadata. A customer past place five gets a session that includes the 497 setup price.
3. **Webhook confirms.** A Stripe webhook (`checkout.session.completed`, `customer.subscription.created`, `customer.subscription.deleted`, `invoice.payment_failed`) updates the place: `reserved` becomes `active` when the subscription is created and paid, and returns to free when the reservation expires unpaid or the subscription is cancelled within the trial. Events are processed once by event id (idempotent) and the signature is checked.
4. **HQ shows both numbers:** reserved and confirmed, and flags any mismatch with Stripe.
5. **Fail closed:** if the Store or Stripe cannot be reached, no place is granted and the sale proceeds at full price or waits for the owner.

## Least privilege and secrets
- Webhook endpoint secret: stored as a Cloudflare secret on the Books worker, typed by the owner, never in this repo or chat.
- Server-side Stripe key: a **restricted** key limited to Checkout Sessions (write) and Subscriptions and Invoices (read). No refunds, no payouts, no customer data export.
- HQ keeps its separate read-only key.
- Nothing is created in Stripe and no webhook is registered until the owner approves each step.

## Cancellation rules to decide with the owner
- Does a place come back if a founding client cancels in the first 7 days? Proposed: yes. After that, no (the setup fee was waived and the place was used).
- How long does an unpaid reservation hold a place? Proposed: 7 days.
