# Localdesk: progress summary (25 Oct 2026)

## Business basics
- **Localdesk** ("Local Desk AI Consultancy"), sole trader **Giovanni (Gio) Petrucci**, Saltash, Cornwall. **Not VAT registered.**
- Email **hello@localdeskai.co.uk** (forwards to Gmail via Cloudflare). Mobile +447700900000.
- Offer: AI receptionist for local trades. Answers missed calls 24/7, takes the details and texts a summary to the business.

## Key decisions
| Decision | Detail |
|---|---|
| Price (live) | **£397/month, no VAT**, 300 minutes included, extra 25p/min (warning at 80%, invoiced via Stripe at month end). Website is a separate extra: £495 + hosting. £497 setup **waived for first 5 founding clients**. 3-month minimum, then monthly with 30 days' notice. |
| Hook | **7-day free trial**, run by Stripe (card/Direct Debit taken up front, charged on day 8). |
| Three-tier pricing | **On hold.** Starter £199 (150 min), Growth £397 (500 min), Lead Machine £997 (coming soon), 25p/min overage with 80% warning. Built on the `site-redesign` branch, not live. |
| 01752 741686 | **Public demo line.** Prospects ring it to try Mia, and each call texts Gio as a lead. Not Gio's own receptionist. |
| Website | Separate extra: £495 + £25–40/month hosting. No discounts; the free week is the only deal. |
| Payments | **Stripe** (cards + Bacs Direct Debit), not GoCardless. |
| CRM | Lead tracker page + spreadsheet now. HubSpot free CRM later (20+ leads). |
| Meta ads | **Deferred** to later this week. Facebook page done. Ad account and Pixel not yet. |
| Automation | Later (see automation-later.md). |
| Sales rules (PECR) | Phone calls OK after a TPS check. **No cold texts/emails to sole traders.** |

## Website: www.localdeskai.co.uk
- Repo **gpetrucci1888/localdesk-site**. Pushing to `main` deploys automatically via Cloudflare.
- **Live now:**
  - redesigned homepage, call animation with trade picker, missed-call calculator, FAQ, mobile booking bar
  - Calendly booking (opens in a new tab)
  - **"Talk to Mia" live browser demo** (Vapi)
  - **demo line 01752 741686**
  - **7-day free trial**, £397 pricing
  - privacy policy and terms (with a free trial section), sole trader footer
- **Not live (branch `site-redesign`):** three plans; cookie banner + Meta Pixel + Calendly pop-up + ad tracking (all off until a Pixel ID is added). This branch is older than the free trial and demo line, so it would need merging first.
- Missing: business address, ICO number in the privacy policy, Meta Pixel and domain tag.

## Phone and call system
- **Twilio:** approved. Number **+44 1752 741686** (Plymouth, **voice only, no SMS**). Compliance registration: "United Kingdom: Local – localdeskAI" (business).
- **Vapi:**
  - Number imported ("Local test line"), assigned to **Mia Localdesk** (`3d96293a-41d2-4c42-8edd-7d4039e58f76`), running the demo prompt (plays any business's receptionist).
  - Public key `5f4a7101-…` is on the website.
  - Server URL = the Worker, with header `x-vapi-secret`.
  - Fallback should be Gio's mobile.
  - Credit topped up.
- **Cloudflare Worker** `localdesk-call-summaray.gpetrucci93.workers.dev`:
  - Variables: VAPI_SECRET, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, CLIENTS (DemoLine version: sender "DemoLine", texts +447700900000, no text-back), SMS_SENDER=Localdesk.
  - **Tested:** summary texts and missed-call texts arrive. ✅
  - Summary **emails not set up** (needs a Resend account).
- **Voice issues found:** sounded too AI, stuttered or switched language, interrupted, hung up, promised "today". Fixes were given (English-only voice model `eleven_flash_v2`, stability 0.5, latency 2; wait 0.8s + smart endpointing; end-call off; no-promises prompt). **Check they're all published.**

## Stripe (live account)
- Activated: sole trader. Payouts weekly on Mondays. Radar Standard. Descriptor "LOCAL DESK AI".
- Products: **Localdesk £397/mo**, Starter £199/mo, Growth £397/mo, Lead Machine £997/mo, Setup fee £497 one-off.
- **Payment link (Localdesk, 7-day trial):** https://buy.stripe.com/4gMdR1gUdenVfzeg3T8IU00
- **Still to do:**
  - turn on Bacs Direct Debit (it wasn't showing on the link)
  - turn on the trial-ending reminder email
  - turn on the customer portal
  - connect FreeAgent
  - check the link collects business name and phone

## Other admin
- ICO fee **paid** (registration number not yet sent to Claude).
- Google Business Profile **started** (verification pending).
- Facebook Page **created**: bio, contacts, profile and cover images.
- Calendly: event renamed "Localdesk demo", 15 minutes, link still `/30min`. **Don't change the link ending**, or the website buttons break.

## Files and tools
- **Lead tracker (private page):** <private link removed>
- **Onboarding templates (doc):** <private link removed>. It still has `[£199 / £397]` placeholders; use £397.
- **Launch folder:**
  - Localdesk-roofer-calls.xlsx (call log, summary, script, Q&A, where to find roofers; £397 only; includes the demo line)
  - client-receptionist-template.md, client-onboarding.md, outreach.md, meta-ads.md, sunday-launch-checklist.md, automation-later.md, george-vapi-script.md
  - call-summary/worker.js
  - ad video + 2 stills, Facebook profile and cover images

## Open questions
1. Assistant name: Decided: Mia.
2. Final pricing: one plan or three tiers?
3. Business address for the website and terms.
4. Is the Vapi voice good enough now?
5. Payout account: see private notes.
6. Onboarding form (Tally) on the website: later?

## Exact next steps
1. **Start calling roofers** using the spreadsheet: TPS check first, give out the demo line.
2. **Stripe:** Bacs on, trial reminder email, customer portal, connect FreeAgent.
3. **Send Claude the ICO number** (ZA…) to add to the privacy policy.
4. **Vapi:** check Mia's fixes are published, then test-call 01752.
5. **Build the client template assistant** in Vapi before the first sale (client-receptionist-template.md).
6. Get a professional indemnity insurance quote.
7. Later this week: Meta ad account + Pixel + domain tag, then launch ads (£10/day for 25 days).
8. Optional: Resend for summary emails, business address, onboarding form.

## Update: 27 Oct 2026 (end of day)

**Connected to Claude (cloud environment secrets):** Vapi (api.vapi.ai), Twilio (api.twilio.com, Basic auth API key), Cloudflare (api.cloudflare.com: Workers Scripts edit, Workers Tail read, Account Analytics read), Stripe (api.stripe.com, restricted key), Calendly (api.calendly.com), GitHub, Gmail. Next: Google Calendar connector (claude.ai/customize/connectors).

**Vapi assistants:**
- `3d96293a…` **Mia Localdesk**: live demo line 01752 741686. Still has OLD pricing text ("no per-call charges", "free website"): fix when switching over.
- `4cb990af-876c-4157-a987-09db3b85f284` **TEST - Mia booking**: new version being tested. Books quote visits via Google Calendar tools (availability `31df3174…`, create event `312b31ab…`; credential `google.calendar.oauth2-authorization` = Gio's Google account, books into his primary calendar). Changes: shorter greeting with AI + recording notice, one-line wrap-up, no lead capture or selling, background sound off (Vapi default "office"), warmer voice Lily `pFZP5JQG7iQjIQuC4Bku` stability 0.4, "Tamar"→"Taymar" and "Localdesk"→"Local Desk" voice replacements, Tamar keyterms, numbers read back in groups, updated pricing facts. **When Gio is happy: copy model/voice/transcriber/firstMessage/backgroundSound onto Mia and delete the test.**
- `190ccf95…` **PRACTICE - Random Prospect**: practice partner (Steve/Mike/Jason/Kev/Dave). Ring Gio with POST /call only when he says "ring me".
- `734343a2…` **Template (Copy)**: client template (Deepgram nova-3, eleven_turbo_v2). No server URL yet: add the call-summary server + secret when building first client.

**Offer now:** £397/month, 300 min included (25p extra, warning at 80%), 7-day free trial, £497 setup waived for first 5. Website = separate extra £495 + £25–40/month hosting, NO discounts. Diary booking = add-on ~£75/month. Trades only.

**Live site:** local SEO (Cornwall/Plymouth), sitemap + robots, social preview image, 404 page, /example (Carrick Ridge Roofing demo site, noindex). Web Analytics on (44 views since 24 Oct, mostly bots/US).

**Call sheet:** <private link removed> (source in scratchpad call-sheet.html, not in repo).

**Gio's routine:** 3 calls a day at 5:00–6:00pm, Saturday 9–12 backup. Call list: private sales notes. Top up Vapi credit.

## Client template (28 Oct)
- `ops/client-prompt.txt` is the client receptionist prompt; `ops/new_client.py <client.json>` creates/updates a client's Vapi assistant (see `ops/example-client.json`).
- Example client assistant: 734343a2 "CLIENT - Carrick Ridge Roofing".
- Call texts: put the summary Worker URL + x-vapi-secret header on the client's phone number in Vapi (copy from the 01752 number), and add the client to the Worker's CLIENTS setting.
- Live Mia now uses the approved test config (voice, booking tools, no office noise). Backup of the old version is not in git.

## Gio's rules for call scripts (IMPORTANT, 28 Oct)
- Talk like a normal person, not a salesman. No pitch lines, no stats, no "a lot of roofers tell me…", no clever hooks.
- Don't open by saying what you sell ("I sort out phone answering…"). Just say hi, who you are, then ask a normal question about THEIR business.
- Keep lines short. Short replies in chat too, no filler.
- Answer him and ask before changing anything. Don't ring him until he says.

## State at end of 28 Oct
- Call sheet (one for every call, flow style): <private link removed> . Opener "Alright {name}, it's Gio from Localdesk, over in Saltash." Buttons: Rang earlier, Pitch, How much, Robot ("AI employee I've trained"), Send info, Bad time, Not interested, Voicemail.
- Lead tracker: in the private sales notes.
- (personal note removed)
- Google Calendar connector is connected. Google Business Profile "LocalDesk Ai Consultancy" exists (verified). Calendly asks business/trade/phone; hours 9-8 weekdays, Sat 9-5. Stripe link asks Business name.
- Facebook token not done (logins blocked); retry from phone browser. TPSCheck not signed up yet. FreeAgent: just connect Stripe inside FreeAgent.
- Mia: more human ("mm, right, okay") live. West Country voice: Gio to pick from ElevenLabs voice library.
- Next week: Gio building an AI consultancy brand on GoHighLevel (GHL). Google listing is already "LocalDesk Ai Consultancy". Decide: same Localdesk name or new brand; which services (receptionist, websites, Google profile, ads, AI help).

## New offer idea: QuickBooks "less pressure" setup (29 Oct)
- A plumber Gio met on site wants "something that deals with everything" and he takes it to his accountant. He uses QuickBooks himself; everything bugs him.
- Offer: set up QuickBooks to run itself (bank rules, invoice reminders, receipts), plus text-a-receipt and a monthly summary text. £395 setup + £150/month done-for-you (monthly tidy).
- Doing books for money needs AML supervision first: HMRC (~£300 application + £400/yr + ~£40 approval, fees from 1 Dec 2025) or a body like ICB/IAB/AAT. Register only after a firm yes.
- Next: get plumber's details, 30-min sit-down with his QuickBooks open, one-page plain offer.

## QuickBooks connector (29 Oct)
- Intuit developer account (Gio's), workspace "Localdesk", app "Localdesk Books" (development keys). UK sandbox: "Sandbox Company GB".
- Worker `books` (code in workers/books): /connect?k=ADMIN_KEY -> Intuit Allow -> /callback saves tokens in Durable Object; /companies and /qb/<realmId>/<path> need header X-Key = ADMIN_KEY. Secrets set: QB_CLIENT_ID, QB_CLIENT_SECRET, ADMIN_KEY; QB_ENV=sandbox. Redirect URI on Intuit app: https://books.gpetrucci93.workers.dev/callback
- Deploy updates with keep_bindings ["secret_text"] so secrets survive.
- Gio allowed *.gpetrucci93.workers.dev and localdeskai.co.uk in the cloud environment (works from next session). Env secret for host books.gpetrucci93.workers.dev header X-Key should be set.
- Not yet done: click the connect link for the sandbox company, then test /companies and a query.
- Receipt demo worker `receipt-demo` (workers/receipt-demo): snap/upload photos or PDFs, Workers AI reads them. Link key is a Worker secret (KEY).
- 29 Oct: joined up. Receipt page "send to QuickBooks" -> receipt-demo worker (service binding BOOKS, secrets KEY/BOOKS_KEY, REALM=sandbox realm) -> books /file/<realm>: finds/creates supplier, skips duplicates (same supplier+date+total), picks expense account by category, sets UK VAT code (20% S / 5% R / No VAT), pays from first bank account, attaches photo. Tested live in Sandbox Company GB (expenses 183, 184, 185).
- 29 Oct: receipt-demo is now the "Books" phone app (installable, tabs Overview/Receipts/Owed/Invoice) at receipt-demo.gpetrucci93.workers.dev/<KEY>/. Connector endpoints added: summary, owed, remind, invoice, recent. Tax pot = 25% of profit (rough guide). Test invoices "Mrs Smith (test)", "Mr Jones (test)" in sandbox. Next ideas: monthly text (cron + Twilio), bank sorting, voice notes, CIS, MTD pack, production keys for real client.
- 29 Oct (later): added Tidy up (Uncategorised expenses with AI-suggested category, one tap to move), Say it (typed/spoken expense -> parse -> file), CIS invoices (labour/materials lines, 20% of labour deduction shown), MTD quarter card + CSV for accountant, monthly text + owner check report (cron 08:00 UTC on the 1st; needs TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN secrets on the books worker; OWNER_PHONE set; sandbox client phone = Gio). Bank feed "For review" is NOT available via QuickBooks API.
- 29 Oct (completion pass): connector supports many clients. POST /invite {name, phone, env} -> one-off connect link (14 days); on connect the client gets their own app link (APP_URL/<appKey>/) and Gio gets a text. Production keys go in QB_PROD_CLIENT_ID / QB_PROD_CLIENT_SECRET; each connection remembers sandbox/production. /disconnect page, POST /revoke/<realm>. App worker resolves any app key via BOOKS /app/<key>; demo KEY still works; "demo-practice" also points at the sandbox.
- Drafted public/books/privacy.html and terms.html (NOT pushed: Gio must approve screenshots first), plus Intuit approval answers and a client service agreement (Localdesk/10 Bookkeeping).
- Gio added a finance plugin in claude.ai Customize to help with bookkeeping (loads in new sessions). Use it alongside the books connector for monthly checks.
