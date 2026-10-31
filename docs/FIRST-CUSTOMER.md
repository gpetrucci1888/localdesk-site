# First customer: go / no-go and launch routine

Website is frozen (Lovable stopped). Social is parked. Everything here uses what HQ already does.

## Go / no-go (31 Oct 2026)
| Step | Status | Evidence |
|---|---|---|
| Cold calls to book Zoom demos | GO | Script `COLD-CALL-SCRIPT.md`, TPS and do-not-call tick in HQ, privacy page has the sales-calls paragraph. No money is taken on a call. |
| Zoom demo of Mia | GO, with one honest caveat | Demo line and flow work. No ten-call quality test has been placed (`MIA-TEST-SCRIPT.md`), so call quality is unproven. Do the demo call yourself once before the first Zoom. |
| Lead to onboarding in HQ | GO | Stages, next action, Zoom date, TPS banner, checklist. 240 tests and four browser suites pass on synthetic data. Mocked Stripe, Vapi and Twilio only. |
| Signup link and trial | GO in test mode only | Real Stripe test checkout verified once (7-day trial, no setup fee, webhook delivered). Founding place, cancel inside 7 days and failed card are logic-tested only. |
| Taking real money | NO-GO | Stripe is in test mode. Live prices, restricted key and webhook are not in Cloudflare. Not assumed ready, nothing switched. |
| Books for a client | GO for QuickBooks and Xero, limited | FreeAgent is tested on the sandbox only. Quotes, profit per job and the accountant pack are QuickBooks only. Say this on the call. |

True technical blockers: none for calls and demos. For charging: live Stripe (owner only).

## The single next owner action
Place one test call to the demo line (01752 741686) as a customer before the first Zoom, and tell me how it sounded. That is the only thing standing between today and a first demo. Stripe live mode is needed only when a prospect says yes, and I will ask for it then, one step at a time.

## Launch-day routine (existing HQ screens)
1. **Home:** read the banners: follow-ups due, Zoom today or tomorrow, setup fees to invoice.
2. **Leads, Add a lead:** name, number, business, "phone call". Open it and set the TPS and CTPS result in Call plan. Registered or do-not-call: do not ring.
3. **Ring** with Call. Afterwards set the stage, notes, **Next action** and date.
4. **Interested, Zoom agreed:** set Zoom date, time and link, stage Zoom booked. Only message them if they agreed to be messaged.
5. **Demo:** follow `ZOOM-DEMO-FLOW.md`, then stage Demo attended.
6. **Yes:** check founding places (HQ Leads card), then **Make a payment link**, send it yourself, stage Signed up (onboarding). Their lead page shows the checklist and next step; follow `MIA-ONBOARDING.md`.
7. **Trial:** HQ shows trial end. Day 3 check-in call, day 6 decision call, both set as Next action dates.

## Phone opener (your own words, built on the existing script)
"Hi, is that [name]? It's Gio from Localdesk in Saltash. I work in construction project management, so I know what it's like when you're on a roof or under a floor and the phone goes. Have you got 30 seconds?" Then the question in `COLD-CALL-SCRIPT.md`: "How do you handle calls when you can't pick up?" The aim is to book the Zoom, not to sell on the call. No price unless they ask.

## Follow-up cadence (set each as HQ Next action)
- No answer: try again in 2 days, then 5 days, stop after three tries. Leave no voicemail selling anything.
- Interested, no Zoom yet: ring back in 2 days.
- Zoom booked: confirm with a call the morning of, only if they agreed.
- After the demo: ring the next day.
- Trial: day 3 and day 6 calls.
- "Not now": ask when to ring, set that date, nothing sooner.
- "Don't ring": tick do not call at once.

## Demo checklist
Demo line rung once today. Vapi balance checked. Founding places left known. Zoom screen share on the Receptionist page. Notes open on the lead. After: stage, notes, next action.

## Honest limits to say out loud
Mia is an AI and says so, calls are recorded, she takes details and does not quote, book or take payments. Books: QuickBooks fully, Xero mostly, FreeAgent being confirmed. No results or customers to quote yet.
