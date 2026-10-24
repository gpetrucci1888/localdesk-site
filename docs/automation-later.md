# Automation: for when you're properly set up

Not needed for launch. Come back to this once you have a few clients and the basics are running.

## Connect your tools
- **Connectors**: claude.ai/customize/connectors. Gmail is already connected. Add Stripe, HubSpot and Google Calendar if they're listed. Start a new Claude session after connecting.
- **Tools without a connector** (Vapi, Twilio, Calendly): connect through their APIs, with keys stored as environment secrets. Never paste keys into chat.
- **Your laptop**: run Claude there with the Claude Desktop app, or `claude remote-control` in a terminal (it then shows in the Claude Code app on your phone).

## Automations to set up
| Automation | Runs | Needs |
|---|---|---|
| Morning briefing: new Calendly bookings, emails to answer, follow-ups due | Weekday mornings | Gmail + lead tracker |
| New bookings and enquiries added to the lead tracker automatically | With the briefing | Gmail + lead tracker |
| Follow-up email drafts waiting in Gmail for you to send | With the briefing | Gmail |
| 80% minutes warning texted to clients | Daily | Vapi + Twilio (Cloudflare Worker) |
| Monthly client report: calls, enquiries, minutes | 1st of the month | Vapi |
| Weekly ads report: spend, cost per booked demo | Mondays | Meta connection or a weekly export |
| Move leads to HubSpot's free CRM | Once, when you have 20+ leads | HubSpot connector |

## Rules
- Claude drafts; you approve anything sent to clients or prospects.
- Payments, contracts and anything legal stay with you.
