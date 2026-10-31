# Stripe setup: what is built, and the exact steps for the owner (nothing is created in Stripe yet)

## Built on branch `stripe-checkout` (tested with a fake Stripe, not deployed)
- **Checkout link from a lead.** In HQ, a lead page has "Make a payment link". It asks Stripe for a Checkout Session and shows the link to the owner only. Nothing is sent to the customer: the owner copies and sends it.
  - Founding Receptionist client: monthly price only, 7-day free trial.
  - Any other Receptionist client: monthly price plus the 497 pound setup fee, 7-day free trial.
  - Books: monthly price plus the 395 pound setup fee, never waived, no trial.
- **Signed webhook** at `https://books.localdeskai.co.uk/stripe/webhook`. Stripe signature checked (5-minute tolerance), every event handled once.
- **Founding places** (five): reserved when the owner ticks the waiver on a lead (held 7 days), become permanent when the subscription starts, come back if the client cancels within 7 days, expire if nobody pays. If a sixth founding subscription ever arrives, it is flagged (not granted) and shown by `GET /founding` as a flag.
- **Fails closed:** with any secret or price id missing, the webhook answers "not set up" and the checkout explains what is missing. No call to Stripe is made.

## Owner steps (in this order; each is yours to approve and type)
1. **Stripe, Products:** create four prices. Receptionist 397 pounds monthly. Receptionist setup 497 pounds one-off. Books 150 pounds monthly. Books setup 395 pounds one-off. Copy the four price ids.
2. **Stripe, restricted key for checkout:** a restricted key with only "Checkout Sessions: Write". Nothing else.
3. **Stripe, webhook:** add the endpoint above. Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy its signing secret.
4. **Cloudflare, worker `books`, Variables and Secrets:**
   - Secrets: `STRIPE_SECRET_KEY` (the restricted key), `STRIPE_WEBHOOK_SECRET`.
   - Variables: `STRIPE_PRICE_RECEPTIONIST`, `STRIPE_PRICE_RECEPTIONIST_SETUP`, `STRIPE_PRICE_BOOKS`, `STRIPE_PRICE_BOOKS_SETUP`. Optional: `CHECKOUT_SUCCESS_URL`, `CHECKOUT_CANCEL_URL`.
5. **Cloudflare, worker `hq`:** the read-only `STRIPE_KEY` for revenue figures, and `STRIPE_PRICES_RECEPTIONIST` and `STRIPE_PRICES_BOOKS` (comma-separated price ids, monthly and setup) so the paying count classifies correctly.
6. **Test with Stripe test mode first,** using a test card and a test lead. Check the lead shows a link, a test subscription lights up a founding place, and cancelling it gives the place back.
7. Then go live with live-mode keys and prices.

## Decisions for the owner (proposed defaults are what is built)
- Does a founding place come back if the client cancels in the first 7 days? **Built: yes.** After 7 days it stays used.
- How long does an unpaid reservation hold a place? **Built: 7 days.**
- A founding client's setup fee is waived. Is the 7-day trial also given to non-founding Receptionist clients? **Built: yes** (it is on the website).

## Not built
- Customer portal (card updates, invoices), proration rules, refunds, and any automatic provisioning of the Vapi assistant or Twilio number after payment. Each of those needs a separate owner decision, and Vapi and Twilio changes need approval one at a time.

## Owner action list: Stripe TEST mode in about 15 minutes
Do these in Stripe with the **Test mode** switch on. Never paste a key into GitHub or chat: type each into Cloudflare yourself.
1. **Products and prices** (Product catalogue, Add product). Four prices, all GBP:
   - Localdesk Receptionist: **£397**, recurring, **monthly**.
   - Receptionist setup: **£497**, **one-off**.
   - Books by Localdesk: **£150**, recurring, **monthly**.
   - Books setup: **£395**, **one-off**.
   Copy each price id (starts `price_`).
2. **Checkout key** (Developers, API keys, Create restricted key): only **Checkout Sessions: Write**. Copy it.
3. **Read-only key for HQ** (restricted key): **read** on Customers, Subscriptions, Invoices, Charges, **Prices**. Copy it.
4. **Webhook** (Developers, Webhooks, Add endpoint): `https://books.localdeskai.co.uk/stripe/webhook`, events `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy its signing secret.
5. **Cloudflare, worker `books`, Variables and Secrets:** secrets `STRIPE_SECRET_KEY` (step 2), `STRIPE_WEBHOOK_SECRET` (step 4). Variables `STRIPE_PRICE_RECEPTIONIST`, `STRIPE_PRICE_RECEPTIONIST_SETUP`, `STRIPE_PRICE_BOOKS`, `STRIPE_PRICE_BOOKS_SETUP` (step 1).
6. **Cloudflare, worker `hq`:** secret `STRIPE_KEY` (step 3). Variables `STRIPE_PRICES_RECEPTIONIST` = the Receptionist monthly price id, `STRIPE_PRICES_BOOKS` = the Books monthly price id.
7. Open **HQ, More, Stripe check**. Every line should be green. It tells you what to fix in plain words.
8. Run `docs/JOURNEY-TEST-PLAN.md` steps 1 to 6 with Stripe's test card 4242 4242 4242 4242.
Rules built in: Receptionist £397 a month with a 7-day free trial, £497 setup waived only for the first five founding clients; Books £150 a month plus £395 setup, no trial, never waived.
