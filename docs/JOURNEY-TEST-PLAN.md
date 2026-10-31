# Customer journey test plan

Journey: website enquiry, qualified lead, correct offer and founding place, Stripe checkout and webhook, thank-you page, HQ status, safe client onboarding.

## Covered by automated tests today (`test/journey.test.mjs` and others, fake Stripe, fake texts, no network)
| Step | Test |
|---|---|
| Enquiry from a post link (`?utm_source=facebook`) becomes a lead with its source, owner texted naming the source, customer never texted | journey 1 |
| Spam, bad numbers, same person twice (joins one lead) | leads tests, journey 3 |
| Lead moves through the stages in order | leads tests, journey 1 |
| HQ Leads shows founding places reserved and where leads come from | journey 1 |
| Founding waiver: five only, Receptionist only, atomic under eight simultaneous claims, released on lost, untick or delete, fails closed | leads tests |
| Payment link: founding = monthly only plus 7-day trial; other Receptionist = plus 497 setup; Books = plus 395 setup, no trial, never founding | stripe tests, journey 1 and 3 |
| Link shown to the owner only, nothing sent to the customer, success page set | journey 1 |
| Signed webhook activates the place, duplicate event ignored, later update changes nothing | journey 1, stripe tests |
| Cancellation within 7 days frees the place, after 7 days keeps it | journey 1, stripe tests |
| Abandoned checkout: reservation lapses after 7 days, next client can take it | journey 2, stripe tests |
| Forged or unsigned webhook does nothing; Stripe not set up fails closed | journey 2, stripe tests |
| Stripe outage while making a link: plain error, nothing reserved or changed | journey 2 |
| Sixth founding subscription arriving anyway is flagged, not granted | stripe tests |
| Thank-you page: not indexed, no scripts, no claims | thanks test, site browser checks |
| Client onboarding file and assistant checks, bad file never reaches Vapi | mia tests |

## Needs real Stripe in test mode (owner steps in docs/STRIPE-SETUP.md first)
1. Make a payment link for a test lead. Pay with Stripe's test card 4242 4242 4242 4242. Confirm the success page is the thank-you page.
2. Confirm the webhook shows delivered in Stripe, and the lead's founding place counts as active (HQ Leads, `/founding`).
3. Cancel the test subscription in Stripe: the place comes back.
4. Pay with a card that fails (Stripe test card 4000 0000 0000 0341): HQ Payments shows the failed payment.
5. Open a link and close it without paying: the place is held for 7 days then frees.
6. Resend one webhook event from Stripe's dashboard: nothing changes.

## Not yet tested, and known gaps
- Real Stripe, real Vapi calls and real Twilio texts (all need the owner's setup and approval).
- HQ revenue figures against real subscriptions (needs the read-only Stripe key on the HQ worker and the price ids).
- Books onboarding is a checklist the owner follows by hand: payment, software choice, connect link, setup check, first receipt. Nothing automates it yet. The payment step now has the payment link.
- No visitor analytics on the website (deliberately: no cookies or tracking). Lead source via `?utm_source=` is the only attribution.
- Refunds, card updates, invoices and automatic provisioning of the assistant after payment are not built.

## Genuine owner blockers (everything else is routine)
1. Stripe: create the prices, restricted key and webhook, and type the keys into Cloudflare (docs/STRIPE-SETUP.md).
2. Decide the cancel-within-7-days and 7-day-hold defaults.
3. Deploy approvals, in this order: `stage1-founding`, then `stripe-checkout`, `thanks-page` and `journey-source` (they contain the earlier ones), then the Mia checks are repo-only. The Books worker, HQ worker and the website all change.
4. Vapi: check the Calls page for Mia Localdesk; approve any Vapi or Twilio change one at a time.
5. Your own legal details for the website (name, address, ICO number, insurance).
