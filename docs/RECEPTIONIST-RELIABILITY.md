# Receptionist reliability checklist (read only: the Vapi and Twilio setup is not in this repo and was not touched)

The owner's evidence on 31 Oct: Vapi balance 19.52 credits; calls on the viewed assistant cost 1 to 29 cents; one Vapi "concurrency limit" email. A concurrency limit is about calls at the same moment, not money.

## To check in the Vapi dashboard (owner)
- [ ] Calls page for every assistant (including Mia Localdesk): long calls, repeated numbers, many calls at once, calls stuck open.
- [ ] Billing and usage: balance, auto-reload on or off, any spend limit.
- [ ] Concurrency limit shown for the organisation.
- [ ] Assistant settings: maximum call duration, silence timeout, end-of-call on voicemail.
- [ ] Public web key restricted to the website domain.

## Proposed protections (each is a separate change that needs owner approval)
1. Maximum call length on demo and web assistants.
2. A spend or balance alert.
3. Blocking any abusive caller number.
4. Decide whether the public demo number and "Talk to Mia" button stay on the website.
5. Wording on the live assistant that callers are told the call may be recorded.

## Code that exists here
- Website live demo has a time limit per browser call (`DEMO_MAX_SECONDS` in public/receptionist/index.html).
- Nothing in this repo can start, stop or change Vapi or Twilio.
