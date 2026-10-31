# Running Localdesk's social media

**Goal:** get UK tradespeople to book a 15 to 20 minute Zoom demo of Mia. Social media is the way people find us warm, before or after a cold call. It is not for cold messaging.

## What exists (all drafts, nothing posted)
- `content/social-30-day.md`: 30 days of posts from Mon 2 Nov 2026, with captions, links per channel, image briefs, Google Business Profile versions, and video ideas for some days.
- `content/social/tiles/day-01.png` to `day-30.png`: one branded 1080 by 1080 image per post.
- HQ, More, Content: the same 30 posts as drafts with planned days, plus the first pack. Approve, plan, tick "I scheduled it" and "It is posted". HQ Home shows "N posts to put out today". HQ never posts anything.
- Lead tracking: every link ends `?utm_source=<channel>`. The website forms turn that into the lead source. HQ Leads, "Where leads come from", shows the count per channel.
- Everything is generated from one file, `content/social-30-day.json`. Edit that, run `node ops/social_build.mjs --tiles`, and the calendar, HQ seed and images update together (a test fails if they drift apart).

## Channels and their job
| Channel | Job | Rhythm |
|---|---|---|
| Facebook page | Main home for posts; trades and local business groups see it by sharing, not by us posting into groups | Daily from the calendar |
| Instagram | Same posts as images; "link in bio" carries the tracked link | Daily |
| LinkedIn | The owner's own voice as a construction project manager; founder posts | Daily (same posts) |
| Google Business Profile | Short local posts that show in search and Maps | 10 short versions are written |
| TikTok and Reels | Short screen recordings and mock-ups for the days that have a video idea | About 6 videos in the month |

## The routine (about 20 minutes a week)
1. **Monday:** open HQ, Content. Read the week's drafts. Edit anything not in your voice. Founder and "personal wording" posts (Days 1, 13, 21, 29) only go out if every word is true for you.
2. **Approve** the ones you like. HQ refuses founding-offer posts when all five founding places are taken.
3. **Schedule** them in Meta Business Suite (Facebook and Instagram), LinkedIn and Google Business Profile (each has its own free scheduler), then tick "I scheduled it" in HQ.
4. **Each day:** reply to comments and messages yourself. Only reply to people who contacted you. Never message someone who has not messaged you first.
5. **Friday, 5 minutes:** open HQ Leads. Look at "Where leads come from". Note which channel and which post style brought enquiries, and tell Claude, who adjusts the next week.

## What is real and what is not
- **Automatic posting or scheduling from here: not built, not live, not tested.** The queue is a record and a reminder.
- **Direct integrations (checked in the connector directory on 31 Oct; none is installed):**
  - **Metricool:** the most direct. It lists tools to create, read and update scheduled posts, analytics, and best time to post. I could not read its documentation here, so which networks it supports (I expect Facebook, Instagram, LinkedIn, TikTok and Google Business Profile) and what it costs on its free and paid plans are unverified. It needs a Metricool account and your pages connected inside it.
  - **Typefully** (X, LinkedIn, Threads and others) and **Taplio** (LinkedIn only): do not cover Facebook or Instagram, so they are not the answer.
  - **Canva:** can make designs. The images here are already generated, so it is optional.
  - **Meta and TikTok ad tools:** these buy ads. Not authorised. No ads, no spend.
  - Meta Business Suite and Google Business Profile have their own free schedulers, which is the safe fallback that works today.
- **The one authorisation that would make scheduling direct:** create a Metricool account, connect your Facebook, Instagram, LinkedIn and Google pages inside it, then connect Metricool to Claude in claude.ai Settings, Connectors. I would then draft each post into Metricool's schedule for you to approve there. I will not post or publish anything myself.

## Safety rules
**No prices or costs in any post** (owner rule): no pound amounts, fees, "free setup" or minimum terms. HQ enforces it: a post that mentions a cost cannot be approved, scheduled or marked posted, and unapproved drafts are cleaned up automatically. Saying there is a 7-day free trial is fine. No invented testimonials, results or "customers"; only claims on the website; the founding offer always says "while places last"; no ads or spend; no posting without your approval; no cold messages; platform rules followed; and the cold-call rules in `docs/COLD-CALLING-COMPLIANCE.md` apply to anything that starts a conversation.
