# Call summaries (Cloudflare Worker)

When a Localdesk receptionist finishes a call, Vapi sends a report here. This Worker:

- **texts the business owner** the caller's name, number, address, job and urgency
- **emails them** the summary, transcript and recording link (optional, needs Resend)
- **missed calls** (caller hung up before saying anything): texts the caller back if they're on a UK mobile, and tells the owner

It's a separate Worker from the website, so deploying it never touches the site.

## One-off setup

1. **Deploy** (from this folder):
   ```
   npx wrangler login
   npx wrangler deploy
   ```
   Note the URL it prints, e.g. `https://localdesk-call-summary.<your-subdomain>.workers.dev`.

2. **Add the secrets** (each command asks you to paste the value):
   ```
   npx wrangler secret put VAPI_SECRET          # make up a long random password
   npx wrangler secret put TWILIO_ACCOUNT_SID   # Twilio console > Account info
   npx wrangler secret put TWILIO_AUTH_TOKEN    # Twilio console > Account info
   npx wrangler secret put CLIENTS              # paste your client list JSON (see below)
   npx wrangler secret put RESEND_API_KEY       # optional, for emails
   ```

3. **Point Vapi at it**, for each client assistant:
   Assistant > Advanced > Server URL: the Worker URL above.
   Add the same `VAPI_SECRET` as the server credential (sent as `x-vapi-secret` or `Authorization: Bearer`).
   Under Server Messages, make sure **end-of-call-report** is ticked.

4. **Structured data**: in each client assistant, set up Analysis > Structured Data with the schema in
   `docs/client-receptionist-template.md`, so the Worker gets `callerName`, `callbackNumber`, `address`, `job` and `urgency`.

5. **Emails (optional)**: create a free Resend account, verify `localdeskai.co.uk` (it gives you DNS records
   to add in Cloudflare), then add `RESEND_API_KEY`. Change `EMAIL_FROM` in `wrangler.jsonc` if you want a different sender.

## Adding a client

Add an entry to your client list (`clients.example.json` shows the format) and run
`npx wrangler secret put CLIENTS` again with the whole updated list.

| Field | What it is |
|---|---|
| `name` | Business name, used in texts |
| `assistantId` | The client's assistant ID in Vapi |
| `vapiNumber` | The Twilio/Vapi number their calls forward to (optional, used to match calls too) |
| `fromNumber` | Number texts are sent from. Use their Twilio number so customers can reply |
| `notifySms` | Mobile numbers to text, in `+447...` format |
| `notifyEmail` | Email addresses for full summaries |
| `missedCallTextBack` | `true` to text back callers who hung up |
| `textBackMessage` | Optional custom text; `{business}` is replaced with the name |

## Test

```
npm test
```
Runs offline with fake Twilio and Resend, and checks answered calls, missed calls, landlines, wrong secrets and unknown assistants.

Check it's running: open `<worker URL>/health`; it should show `{"ok":true}`.
