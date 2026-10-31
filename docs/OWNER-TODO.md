# Your list (owner actions only), in order

Everything else is built and waiting. Tick as you go. Anything marked "tell Claude" needs your word in chat first. Never paste a key into chat or GitHub: type it into Cloudflare yourself.

## 1. Check what is already live (15 minutes)
- [ ] HQ smoke test: `docs/SMOKE-TEST.md` (11 lines, your own test lead). Tell Claude any line that fails.
- [ ] HQ, More, **Stripe check**: it should show red items in plain words (Stripe not set up yet). If it shows an error page instead, tell Claude.
- [ ] HQ, More, **Face ID login**: add your phone.
- [ ] Vapi, **Calls** page, for **Mia Localdesk**: anything odd (stuck calls, many calls at once)? Balance still fine?

## 2. Before you cold call anyone (the legal basics)
- [ ] **ICO registration** (you need your number for the privacy page).
- [ ] Your **business address** for the privacy page. Insurance wording if you want it shown.
- [ ] A way to check **TPS and CTPS** (find the current options and costs on their websites). Do not cold call until you can check. Guide: `docs/COLD-CALLING-COMPLIANCE.md`.
- [ ] You can ring out **showing your number**.
- [ ] Read `docs/SALES-WORKFLOW.md` and `docs/ZOOM-DEMO-FLOW.md` once.

## 3. Stripe test mode (about 15 minutes): `docs/STRIPE-SETUP.md`, "Owner action list"
- [ ] Four prices in Stripe test mode: Receptionist £397 monthly, Receptionist setup £497 one-off, Books £150 monthly, Books setup £395 one-off.
- [ ] Restricted checkout key, read-only HQ key, webhook to `https://books.localdeskai.co.uk/stripe/webhook` (created, updated, deleted).
- [ ] Type the keys and price ids into Cloudflare (`books` and `hq`).
- [ ] HQ, More, **Stripe check**: all green.
- [ ] Decide two defaults (tell Claude if you want either changed): cancelling within 7 days gives a founding place back (built as yes); an unpaid hold lasts 7 days (built as 7).
- [ ] Run `docs/JOURNEY-TEST-PLAN.md` steps 1 to 6 with the test card 4242 4242 4242 4242.

## 4. Mia
- [ ] The ten test calls: `docs/MIA-TEST-SCRIPT.md`. Ticked every row?
- [ ] Confirm the claims you will make: 7-day free trial honoured, 300 minutes included, answers day and night, text summary after each call, recording notice (list in `docs/LAUNCH-READINESS.md`).

## 5. Books
- [ ] Connect one test or your own accounting company (QuickBooks, FreeAgent or Xero) through "Make the connect link" and file one receipt. The lead page should then show the software, Connected, and "A receipt has been filed".
- [ ] FreeAgent: the live approval email, if it has arrived.

## 6. Things waiting for your word (tell Claude)
- [ ] **Turn on logs** for the `books` and `hq` workers (a Cloudflare setting; worth doing before real customers). Say "enable logs" and I will tell you the exact clicks.
- [ ] **Website merge** (publishes the site): thank-you page, softer wording, source tracking, a draft sales-calls paragraph for the privacy page, and the preview-builds fix. Read the privacy paragraph first (`public/privacy.html`, "Business contacts and sales calls"). Say "merge website" when happy.
- [ ] **Live payments** come last, and you switch Stripe to live mode yourself, after sections 3 and 4 pass.

## Parked (no action needed now)
Claude and GPT bridge (`gpt-bridge`, needs an OpenAI key and budget: your call, later), Lovable website add-on, social posting automation, Meta ads, caller exclusion lists for Mia, any Vapi or Twilio change.
