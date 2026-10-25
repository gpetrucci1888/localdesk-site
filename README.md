# Localdesk website

Edit public/index.html. Every push to main deploys automatically via Cloudflare.

## Call-summary texts (src/worker.js)

After every real phone call, Vapi posts an end-of-call report to `/api/vapi`. The Worker checks the secret, finds which client the assistant belongs to, and texts them a short summary through Twilio. Website demo calls (in the browser) are ignored.

Set these as **Secrets** in Cloudflare (Workers > localdesk > Settings > Variables and Secrets):

| Name | What it is |
| --- | --- |
| `VAPI_WEBHOOK_SECRET` | Long random string. Same value goes in the Vapi custom credential. |
| `TWILIO_ACCOUNT_SID` | From the Twilio console. |
| `TWILIO_AUTH_TOKEN` | From the Twilio console. |
| `TWILIO_FROM` | The Twilio number (or sender name) texts come from. |
| `CLIENTS_JSON` | Which assistant belongs to which client (see below). |

`CLIENTS_JSON` example (mobile numbers in international format):

```json
{"<vapi assistant id>": {"business": "Smith Roofing", "mobile": "+447700900123"}}
```

To add a client, add one more entry and save. No code change or redeploy needed.

Test the code with: `node --test test/worker.test.mjs`
