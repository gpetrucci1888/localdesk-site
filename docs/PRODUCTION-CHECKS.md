# Production checks after the 31 Oct deploy (read-only, from Cloudflare's API)

Taken at about 10:08 UTC. Nothing was changed to get this. **Real** means read from Cloudflare. It is not a test of the live site.

| Check | Result (real) |
|---|---|
| Active versions | books `a0a0c13c` (deployed 10:04:49), hq `fa39aeb8` (10:05:14), both at 100%. Previous: books `1c815831`, hq `5d07d17d` (a dashboard edit at 08:29, the owner's passphrase change). |
| Bindings | books: ADMIN_KEY, QB, FreeAgent sandbox, Xero, Twilio, VAPID secrets all present, plus STORE, AI, APP_URL, OWNER_PHONE, SMS_FROM, VAPID_PUBLIC. hq: ADMIN_KEY, OWNER_PASSWORD, BOOKS, BOOKS_URL, VAULT. Identical to before the deploy. |
| Not set (expected) | No STRIPE_* on books or hq. No Stripe webhook secret. |
| Routes | localdeskai.co.uk and www to `localdesk`, hq to `hq`, books to `books`, app to `receipt-demo`. |
| Cron triggers | books: hourly, 07:00 daily, 08:00 monthly (1st), 08:00 quarterly. hq: 06:30 daily backup. All still present. |
| Durable Objects | `books_Store` (Store) and `hq_Vault` (Vault) exist. The new Store and Vault code only adds keys. |
| Errors since 08:00 UTC (Cloudflare analytics) | books 36 requests, 0 errors. hq 30 requests, 0 errors. app 31 requests, 0 errors. Since the deploy at 10:05: books 2 requests and hq 2 requests, all successful. |
| Code in production | The books and hq scripts fetched from Cloudflare contain the new routes (Stripe webhook, founding places, passkeys, content queue). |

## Limits (what this does not prove)
- The live addresses cannot be reached from the build environment, so **no live page or request was checked by Claude**. The owner reported that HQ loads and the Call plan is visible.
- **No logs are kept:** Workers Logs (observability) is off on both workers, so there is no request log or error text to read. Counts above come from analytics only. Turning logs on is a production setting change and needs the owner's approval. It is worth doing before real customers.
- Secrets can be seen by name only, never by value. That is intended.
- Cron runs are not in these counts. Whether the daily backup ran after the deploy shows in HQ, Backups.
- None of this tests real Stripe, Mia calls, or Face ID.
