# Sunday launch checklist: ready for Monday morning

Tick these off in order. **Bold items** are things to send to Claude so it can finish the website side.

## 1. Start everything that needs approval (first thing, ~1 hour)
- [ ] **Twilio**: check approval status. If still pending, message support.
- [ ] **Stripe**: sign up as a sole trader, verify ID and bank, turn on **Bacs Direct Debit**
- [ ] **ICO fee**: pay at ico.org.uk/fee. **Send the registration number** (ZA…).
- [ ] **Insurance**: professional indemnity quote online (same-day cover is common)
- [ ] **Business address** (optional virtual address). **Send the address.**
- [ ] **Facebook Page** + Instagram, **Business portfolio**, **ad account** with payment card
- [ ] **Meta Pixel**: create it. **Send the Pixel ID.**
- [ ] **Domain verification**: Meta-tag option. **Send the tag.**
- [ ] **Google Business Profile**: start it (verification can take days)

## 2. Make calls work end to end (~2–3 hours, with Claude)
- [ ] Deploy the call-summary Worker (`workers/call-summary/README.md`)
- [ ] Add secrets: Vapi secret, Twilio SID and token, client list
- [ ] Optional: Resend account + verify domain for summary emails
- [ ] Make your **template assistant** in Vapi from `docs/client-receptionist-template.md`
- [ ] Buy one Twilio UK number, import it into Vapi, assign it to the template
- [ ] Add yourself as a test "client" in the client list
- [ ] Forward your own mobile using the codes in `docs/client-onboarding.md`
- [ ] **3 test calls**: normal enquiry, pushing for a time, hang up straight away
- [ ] Check the summary text, the email and the missed-call text-back all arrive

## 3. Getting paid (~30 minutes)
- [ ] Stripe product: **Localdesk Starter, £397/month, no tax**
- [ ] Payment link with **Card + Bacs Direct Debit**, asking for business name and phone
- [ ] Customer portal on
- [ ] Connect Stripe to FreeAgent
- [ ] **Send the payment link** (Claude can add a "Sign up" button and put it in the welcome email)

## 4. Website go-live (Claude does this once it has your details)
- [ ] Pixel ID + domain tag in, cookie banner switches on
- [ ] Address + ICO number on the site and in the privacy policy
- [ ] Choose **George or Al** and match the website text
- [ ] Screenshots, then your OK, then live

## 5. Demo assistant tidy-up
- [ ] English-only voice model, stability 0.5, streaming latency 2
- [ ] New demo prompt (no promises, works for any business) published
- [ ] Turn-taking fixed (wait 0.8s, smart endpointing, no auto hang-up)
- [ ] **Vapi credit topped up to $30–50** before the ads start

## 6. Ads (~1.5 hours)
- [ ] Upload `localdesk-ad-vertical.mp4` (Reels/Stories) and the stills
- [ ] Set up the campaign from `docs/meta-ads.md`: Leads objective, £10/day, 25 days, URL parameters
- [ ] 3 ads (A, B, C), submitted by **Sunday evening** so they're approved for Monday

## 7. Monday morning
- [ ] Lead tracker open
- [ ] 20–30 businesses to call (`docs/outreach.md`). Check TPS first, calls not cold texts.
- [ ] First 5 calls before 10am, while trades are on the way to jobs
