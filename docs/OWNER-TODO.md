# Parked for you (short). Everything else is done or on its way.

Last updated 31 Oct 2026. Items marked **say it** need one word from you in the Claude chat. Never paste a key into chat or GitHub.

## Say it (one word each)
- [ ] **"merge website"**: publishes the website (thank-you page design, softer "answers the calls you miss" wording, lead-source links, the sales-calls paragraph in the privacy page, the preview-builds fix). Ready on `launch-candidate`; I tried to publish it and the permission system blocked a production publish on a bare "approve", so it needs those two words.
- [ ] **"enable logs"**: turns on request logs for the books and hq workers, so there is something to read if anything breaks. Worth doing before real customers.

## 5-minute jobs
- [ ] Open your test lead in HQ: it should show "Stripe: subscription trialing" and a note to invoice the 497 pound setup fee on 7 November. Tell me if it does not.
- [ ] HQ read-only Stripe key (Stripe, API keys, create secret key, Custom permissions, Read on Customers, Subscriptions, Invoices, Charges, Prices, Products, named `Localdesk HQ read-only`) saved in Cloudflare on **hq** as a **Secret** named `STRIPE_KEY`. Then HQ Payments and Stripe check show revenue and the price checks.
- [ ] Ring the demo line once to confirm the greeting says calls may be recorded.

## Before you cold call anyone
- [ ] ICO registration, your business address (and ICO number) for the privacy page, a way to check TPS and CTPS, and ringing out showing your number. See `docs/COLD-CALLING-COMPLIANCE.md` and `docs/COLD-CALL-SCRIPT.md`.

## Before real customers
- [ ] The ten Mia test calls (`docs/MIA-TEST-SCRIPT.md`).
- [ ] Optional more Stripe test payments: a founding lead (tick the founding box on the lead first), cancelling inside 7 days, and the failed card 4000 0000 0000 0341. Or tell me to do the founding and cancel ones if you give the Stripe connection write access to the sandbox.
- [ ] Switching Stripe to live mode is yours alone, last.

## Decisions I have assumed (tell me if you want any changed)
Cancel inside 7 days gives a founding place back; an unpaid hold lasts 7 days; the 497 pound setup fee is invoiced when the trial ends (the terms say nothing is charged during the trial).
