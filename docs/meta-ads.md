# Meta ads launch pack

Plan: **£10 a day for 25 days (£250)**. Review on day 7 and day 14. Keep going while a booked demo costs under ~£75; rethink if it's over ~£150.

---

## 1. Accounts (about 45 minutes)

1. **Facebook Page**: "Localdesk". Profile picture: the logo. Cover: a screenshot of the website hero. Add website, email and a short "About": *AI receptionist for local businesses. Answers your calls 24/7, takes the details and texts you. £397/month.*
2. **Instagram business account** (optional but recommended), linked to the Page.
3. **Business portfolio** at business.facebook.com. Add the Page and create an **ad account** (currency GBP, time zone London). Add a payment card.
4. **Domain verification**: Business settings > Brand safety > Domains > Add `localdeskai.co.uk` > choose **Meta-tag**. Send the tag to Claude; it goes in the website `<head>` (placeholder is already there).
5. **Pixel**: Events Manager > Connect data sources > Web > name it "Localdesk website" > copy the **Pixel ID** and send it over. It goes in `META_PIXEL_ID` in the website. The cookie banner then switches on automatically.
6. **Aggregated events**: once the domain is verified, in Events Manager set **Schedule** as the top-priority event, then **Lead**.

## 2. What the website tracks (already built)

| Event | When |
|---|---|
| PageView | Visitor accepts cookies |
| Lead | Clicks any "Book a demo" button |
| **Schedule** | Actually books in the Calendly pop-up (**the one that matters**) |
| Contact | Clicks the email address |
| StartDemoCall (custom) | Starts a call with the AI demo |
| UseCalculator (custom) | Uses the missed-call calculator |

Visitors who click "No thanks" aren't tracked, so Meta will under-count a bit. That's normal and legal.

## 3. Campaign setup

| Setting | Choose |
|---|---|
| Objective | **Leads** |
| Conversion location | Website |
| Conversion event | **Lead** to start. Switch the ad set to **Schedule** once you have about 10–15 bookings. |
| Special ad category | None |
| Budget | £10/day at ad set level, 25-day end date |
| Location | Start with Cornwall + Devon (or a 40–50 mile radius of you). Exclude nothing. |
| Age | 25–65 |
| Audience | Advantage+ audience, with suggestions: Small business owners, Self-employment, Tradesperson, Plumbing, Roofing, Electrician, Hairdresser, Construction |
| Placements | Advantage+ placements |
| Website URL | `https://www.localdeskai.co.uk/` |
| URL parameters | `utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}` |
| Call to action | **Book now** |

The URL parameters make each Calendly booking show which ad it came from.

## 4. Ads (run 3 at once, let Meta pick)

**Ad A: "Up a ladder" (use the video)**
- Primary text: *Up a ladder when the phone rings? Localdesk answers for you, takes the details and texts you the job, so you can ring back the ones worth winning. 24/7, £397 a month, no VAT, no per-call charges. Try it yourself: talk to our AI receptionist live on our website.*
- Headline: *Never miss another job*
- Description: *AI receptionist for local businesses*

**Ad B: "Missed calls cost money" (use the calculator screenshot or video)**
- Primary text: *Most callers don't leave a voicemail. They ring the next business on Google. Localdesk answers every call you can't, takes the caller's name, number and what they need, and texts it straight to you. Work out what missed calls are costing you on our website.*
- Headline: *What are missed calls costing you?*
- Description: *Answers 24/7. Website included.*

**Ad C: "Founding clients" (use the website hero screenshot)**
- Primary text: *We're taking on 5 founding clients in Cornwall and Devon. You get an AI receptionist that answers your calls 24/7, plus a free professional website, with the £497 setup fee waived. Book a 15-minute demo and hear it answer calls for your business.*
- Headline: *5 founding spots, setup fee waived*
- Description: *£397/month, no VAT*

Keep claims factual. Don't promise results ("double your jobs") and don't address personal traits.

## 5. Day 7 and day 14 check

In Ads Manager, add columns: **Amount spent, Link clicks, CPC, Leads, Schedules, Cost per schedule**.

| What you see | Do this |
|---|---|
| Cost per Schedule under £75 | Keep going. Consider £15/day on the best ad. |
| Lots of Leads (clicks) but few Schedules | People aren't finishing the booking. Shorten the Calendly questions, or offer more time slots. |
| Clicks under 1% CTR | The ad isn't grabbing attention. Swap the image or video and the first line. |
| Nothing after 7 days | Pause, change the audience (e.g. one trade only) or the offer. |

Also watch your **Vapi credit**: ad visitors try the live demo, at roughly $0.10–0.15 a minute.
