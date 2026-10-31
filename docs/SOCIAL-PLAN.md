# Running Localdesk's social media (Facebook Page and Google Business Profile only)

**Goal:** get UK tradespeople to book a 15 to 20 minute Zoom demo of Mia. Only two accounts are used: the **Localdesk Facebook business Page** and the **Localdesk Google Business Profile**. No other platform is needed.

## What exists (all drafts; nothing posted or scheduled)
- `content/social-30-day.md`: 30 days from Mon 2 Nov 2026. Every day has a Facebook post; 14 days (about three a week) also have a short Google Business Profile version. Captions, tracked links, suggested times, image briefs.
- `content/first-batch.md`: **week 1 shown exactly as it would go out** (accounts, dates, times, text, images). This is what to approve first.
- `content/social/tiles/day-01.png` to `day-30.png`: one branded image per post.
- HQ, More, Content: the same posts as drafts with planned days. HQ never posts anything, and refuses to approve any post that mentions a price or cost.
- Tracking: Facebook links end `?utm_source=facebook`, Google links `?utm_source=gbp`. The website form turns that into the lead source, shown in HQ Leads under "Where leads come from".
- All generated from `content/social-30-day.json` by `node ops/social_build.mjs --tiles`; tests fail if the calendar, first batch, HQ seed or images drift apart.

## How posts can actually go out (checked 31 Oct; what I could and could not verify)
| Method | Facebook Page | Google Business Profile | Cost | Verified? |
|---|---|---|---|---|
| **A. Meta Business Suite scheduler** (Meta's own free tool, you are already the admin) | Yes: you paste each post and pick a date and time once; Meta publishes | Not covered | Free | Not verified from here (docs unreachable); this is a standard Meta feature. Not automated by me. |
| **B. Google Business Profile posting by hand** | n/a | Posted from your Google profile; **I could not verify that Google offers native scheduling**, so assume same-day, about two minutes, three times a week | Free | Not verified |
| **C. A scheduler that covers both (Metricool)** | Expected | Expected | Unknown: it has paid plans and possibly a limited free plan; I could not read its pricing or its supported networks | Its listing in Claude's connector directory shows tools to create, read and update scheduled posts and read analytics. The networks and cost are unverified. No other connector in the directory posts to a Facebook Page or Google Business Profile. |
| **D. Direct Meta and Google APIs** | Needs a Meta developer app and review | Google restricts Business Profile API access and needs an application | Free but slow and heavy | Not recommended. |

**Recommendation:** try C, because it is the only route where I can schedule for you after you approve. If it cannot cover both accounts on a plan you are happy with, fall back to A for Facebook plus B for Google, with HQ's Home reminder ("N posts to put out today") doing the nudging.

## The one authorisation to start (no card, no passwords in chat)
Create a Metricool account on its **free plan** (do not enter card details) and connect the **Localdesk Facebook Page** and the **Localdesk Google Business Profile** inside Metricool when it asks (those are sign-ins with Facebook and Google, done by you in their own screens). If Metricool says Google Business Profile needs a paid plan, or asks for payment, **stop and tell me what it says**: I will explain the cost before you decide anything. The step after that, once it works, is connecting Metricool to Claude (claude.ai Settings, Connectors).

## How publishing is approved
1. You read `content/first-batch.md` (exact accounts, text, images, times).
2. You say "approve first batch". That means: schedule those posts at those times on those two accounts, and nothing else.
3. After that, you can approve an ongoing schedule (for example "run weeks 2 to 4 as drafted"). I then schedule inside that scope without asking each time. Anything outside it, any change of wording that touches founder claims or offers, ads, and any spend, still needs your word.
4. Each Friday I report from Metricool (or HQ Leads) what went out, what failed, and which channel brought enquiries.

## The routine if scheduling stays manual (about 20 minutes a week)
Monday: read the week in HQ, Content, edit, approve. Schedule Facebook in Meta Business Suite and post the Google versions at the suggested times. Tick "I scheduled it" and "It is posted" in HQ. Reply to comments and messages yourself, only to people who contacted you. Never message anyone who has not messaged you first.

## Safety rules
**No prices or costs in any post** (owner rule): no pound amounts, fees, "free setup" or minimum terms. HQ enforces it: a post that mentions a cost cannot be approved, scheduled or marked posted. "7-day free trial" is fine. No invented testimonials, results or customers; only claims on the website; the founding offer always says "while places last" and HQ blocks it once the five places are taken; founder wording (Days 1, 13, 21, 29) only if every word is true; no ads or spend; no cold messages; the rules in `docs/COLD-CALLING-COMPLIANCE.md` apply to anything that starts a conversation.
