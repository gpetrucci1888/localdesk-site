# Client onboarding pack

Everything for taking a new client from "yes" to live, in about 30–45 minutes of your time.

---

## 1. Onboarding form (questions to ask)

Make this as a Google Form, or ask the questions on the demo call. Every answer goes into the receptionist template.

**About the business**
1. Business name (as you'd like it said on the phone)
2. Your name, and who else should get call summaries
3. Mobile number(s) for summary texts
4. Email address(es) for full summaries and transcripts
5. What do you do? List your main services.
6. Anything you *don't* do that people often ask for?
7. Which towns or areas do you cover?
8. Opening hours
9. Do you do free quotes? Emergency call-outs?
10. Anything customers often ask that the receptionist should know (payment methods, accreditations, parking, etc.)?

**How calls should be handled**
11. When should Localdesk answer: when you don't pick up, when you're busy, all calls, or out of hours only?
12. What counts as urgent for you?
13. Should missed callers get an automatic text back? (Recommended: yes)
14. Your current business phone number, and is it a mobile or a landline? Which network or provider?

**Website**
15. Do you have a website or domain already? Logo? A few photos of your work?
16. Any reviews or testimonials we can use?

---

## 2. Welcome email (send after they've paid)

> **Subject: Welcome to Localdesk, let's get your receptionist set up**
>
> Hi [first name],
>
> Thanks for signing up, and welcome aboard as one of our founding clients.
>
> Here's what happens next:
>
> 1. **I'll build your receptionist** using the details you gave me. It'll know your services, areas and hours.
> 2. **You'll get a test number** to ring, so you can hear it before anything goes live. Tell me anything you'd like changed.
> 3. **We switch on call forwarding** on your phone (2 minutes, instructions below). From then on, any call you don't answer goes to your receptionist, and you get a text with the details.
> 4. **Your free website** follows within a week or two. I'll send it for you to check first.
>
> **Setting up call forwarding** (do this once we've tested, I'll tell you when):
> Your forwarding number is: **[CLIENT'S TWILIO NUMBER]**
> [Paste the right section from the forwarding guide below]
>
> If anything's not right at any point, just reply to this email or ring me on [YOUR NUMBER].
>
> Cheers,
> Gio
> Localdesk · localdeskai.co.uk

---

## 3. Call forwarding guide (UK)

Replace `NUMBER` with the client's Localdesk (Twilio) number in full UK format, e.g. `07700900123` or `01872123456`. Dial each code like a phone number and press call. The phone will confirm on screen.

**Mobiles (EE, O2, Vodafone, Three, giffgaff, Tesco Mobile, Sky, etc.)**

| Forward calls when... | Dial |
|---|---|
| You don't answer (after about 20 seconds) | `**61*NUMBER**20#` |
| You're on another call / reject the call | `**67*NUMBER#` |
| Your phone is off or has no signal | `**62*NUMBER#` |
| **Turn all of the above off** | `##004#` |
| Check what's set | `*#61#` |

- Most clients want all three of the first rows. That covers every missed call.
- The `20` is the number of seconds to ring first. It can be 5, 10, 15, 20, 25 or 30.
- Some networks charge for forwarded calls, or don't include them in bundles. Ask the client to check their tariff, especially on business plans.
- If a code is rejected, try `**61*NUMBER#` without the seconds, or set it in the phone's settings. On Android it's *Phone app > Settings > Calls > Call forwarding*. On iPhone, *Settings > Phone > Call Forwarding* only does "forward everything", so use the codes instead.

**Landlines (BT and others)**
- Most UK landlines support call divert, but codes and charges vary by provider. BT, for example, offers divert when busy or not answered as a paid feature on many packages.
- Easiest: ask the client to ring their provider and say: *"I'd like to divert calls to [NUMBER] when I'm busy or don't answer."*
- VoIP or business phone systems (3CX, RingCentral, etc.) have forwarding in their app or web settings.

**Always test**: after setting it up, ring the client's number from another phone, don't answer, and check Localdesk picks up and the summary text arrives.

---

## 4. Your setup checklist (per client)

- [ ] Payment received (Stripe link) and terms agreed
- [ ] Onboarding form complete
- [ ] Buy a UK number in Twilio (local area code if possible) and import it into Vapi
- [ ] Copy the template assistant in Vapi and fill in their details (`docs/client-receptionist-template.md`)
- [ ] Add the structured data schema, summary prompt and Server URL
- [ ] Assign the number to the assistant and publish
- [ ] Add the client to the call-summary Worker's `CLIENTS` list and update the secret
- [ ] Make the 3 test calls (normal, pushing for a time, hang-up)
- [ ] Send the client the test number, then make any changes they ask for
- [ ] Send forwarding instructions and test with them on the phone
- [ ] Add them to your lead tracker as **Paying**
- [ ] Book a quick check-in for 1 week later
- [ ] Start their free website
