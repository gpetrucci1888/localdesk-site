# Localdesk owner guide

Written so you can run Localdesk without Claude. No secrets are in this guide.

## Your control room
**https://hq.localdeskai.co.uk** (bookmark it on your phone and computer). Log in with your passphrase and the 6-digit code from the Google Authenticator app. From there:
- **Home**: what needs you today.
- **Customers** and **Payments**: who pays what, failed payments.
- **Books**: add a client, change a client, see their setup, end a client.
- **Receptionist**: links to Vapi (Mia), Twilio (numbers and texts) and Calendly.
- **Backups**: a Books backup every morning. Download one weekly.
- **Settings** and **Help**: where each password lives, and step-by-step guides.

## Where everything lives (all in accounts you own)
- **Cloudflare**: runs HQ, Books and the website, and holds the hidden keys. Log in at dash.cloudflare.com. This is the most important account.
- **GitHub** (gpetrucci1888/localdesk-site): all the code and its history. Public, so no secrets in it.
- **Stripe**: customers and payments. **Twilio**: phone numbers and texts. **Vapi**: Mia. **Intuit developer**: the QuickBooks connection. **Namecheap**: the domain. **Calendly**: booked calls.
- **Books addresses**: app.localdeskai.co.uk (client app, being switched on), books.localdeskai.co.uk (connector), hq.localdeskai.co.uk (HQ). The older gpetrucci93.workers.dev addresses still work.

## Keeping your passwords safe
Use a password manager (Bitwarden is free). Put these in it, and nowhere else: logins and recovery codes for Cloudflare, GitHub, Stripe, Twilio, Vapi, Intuit, Namecheap, Google; your HQ passphrase. Keep the HQ authenticator's setup key there too. Turn on two-step login for Cloudflare, GitHub and Stripe. Never put a password or key in GitHub, an email or a chat.

## If you stop using Claude
Nothing stops. HQ, Books, Mia, the website and the daily backup all run on Cloudflare, Vapi and Twilio, not on Claude. Two things only Claude did, and what replaces them:
1. **Updating the software.** Hire any developer, give them access to GitHub and Cloudflare, and point them at the docs folder and the Help page. Updating takes one command (npx wrangler deploy, with the config files in workers/), or the ops/deploy_workers.py script with a Cloudflare API token.
2. **Setting up new things.** The ops folder has scripts that print their plan and change nothing until run with --apply.

## Making a Cloudflare API token (for a developer, when needed)
Cloudflare, profile icon, **My Profile**, **API Tokens**, **Create Token**, use the **Edit Cloudflare Workers** template, limit it to your account, and store it in your password manager. Give it to a developer only while they work, then delete it.

## Before you take your first paying Books client
1. Register with HMRC for money laundering supervision (Books is bookkeeping for others).
2. Sign the data addendum and agreement with each client, after a professional has checked them.
3. Set up the Stripe payment link for £395 setup and £150 a month. Don't switch on live payments until the steps above are checked.

## If something breaks
Open Help, then "If something goes wrong". Personal data leak: tell the ICO within 72 hours if people could be harmed, and write down your reasons either way.
