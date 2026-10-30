// Content for the owner HQ. This file is in a PUBLIC repo: links, names and instructions only. No passwords, keys,
// customer details, phone numbers or private links, ever. (test/repo-hygiene.test.mjs checks this.)

export const LINKS = {
  books: [
    { name: 'Books privacy policy', url: 'https://www.localdeskai.co.uk/books/privacy.html', note: 'Public page clients see' },
    { name: 'Books terms', url: 'https://www.localdeskai.co.uk/books/terms.html', note: 'Public page clients see' },
    { name: 'Intuit developer dashboard', url: 'https://developer.intuit.com/app/developer/dashboard', note: 'QuickBooks app keys, redirect addresses, production approval' },
    { name: 'QuickBooks Online (UK)', url: 'https://quickbooks.intuit.com/uk/', note: 'Sign up for a trial company to test VAT' },
  ],
  receptionist: [
    { name: 'Vapi dashboard', url: 'https://dashboard.vapi.ai', note: 'Mia assistants, call logs, prompts' },
    { name: 'Twilio console', url: 'https://console.twilio.com', note: 'Phone numbers, text messages, call logs, regulatory bundle' },
    { name: 'Calendly', url: 'https://calendly.com/app/scheduled_events/user/me', note: 'Booked demo calls' },
  ],
  website: [
    { name: 'localdeskai.co.uk', url: 'https://www.localdeskai.co.uk', note: 'Public website' },
    { name: 'Website source and history (GitHub)', url: 'https://github.com/gpetrucci1888/localdesk-site', note: 'Code for the website and the Books workers. Public repo: never put secrets here' },
  ],
  accounts: [
    { name: 'Cloudflare', url: 'https://dash.cloudflare.com', note: 'Workers, domain, DNS, secrets, backups. The root of everything' },
    { name: 'Stripe', url: 'https://dashboard.stripe.com', note: 'Customers, subscriptions, payouts, restricted keys' },
    { name: 'GitHub', url: 'https://github.com/gpetrucci1888', note: 'Code and its history' },
    { name: 'ICO registration and breach reporting', url: 'https://ico.org.uk/make-a-complaint/data-protection-complaints/data-protection-complaints/', note: 'Report a personal data breach within 72 hours if it is likely to risk people' },
    { name: 'HMRC anti-money-laundering supervision', url: 'https://www.gov.uk/guidance/register-or-renew-your-money-laundering-supervision-with-hmrc', note: 'Register before offering Books' },
  ],
};

// Where each credential lives. NAMES AND PLACES ONLY.
export const REGISTER = [
  { name: 'Your HQ passphrase', where: 'Your password manager. A copy is stored (hidden) in Cloudflare', use: 'Logging in to this HQ', recover: 'Set a new one in Cloudflare (Help: Your HQ login)' },
  { name: 'Your HQ phone app code', where: 'The authenticator app on your phone', use: 'The second step of logging in', recover: 'Lost your phone? Help: Your HQ login' },
  { name: 'Books admin key', where: 'Hidden inside Cloudflare, on the Books and HQ workers. You never need to type it', use: 'Lets HQ manage Books clients for you', recover: 'Set a new one on both workers (Help: Changing a password or key)' },
  { name: 'QuickBooks connection keys', where: 'Your Intuit developer account, copied into Cloudflare', use: 'Connecting each client\'s QuickBooks to Books', recover: 'Make new ones in Intuit and update Cloudflare' },
  { name: 'Text message account (Twilio)', where: 'Your Twilio account, copied into Cloudflare', use: 'Login codes and text messages', recover: 'Make a new token in Twilio and update Cloudflare' },
  { name: 'Phone notification keys', where: 'Hidden inside Cloudflare, on the Books worker', use: 'Sending alerts to clients\' phones', recover: 'Can\'t be recovered. New ones are made and clients turn notifications on again' },
  { name: 'Stripe read-only key', where: 'Your Stripe account, copied into Cloudflare (HQ worker)', use: 'Showing your customers and payments in HQ', recover: 'Delete it in Stripe and make a new one (Help: Connect Stripe)' },
  { name: 'Vapi key (Mia)', where: 'Your Vapi account', use: 'Setting up and running Mia', recover: 'Make a new one in Vapi' },
  { name: 'Your Cloudflare login', where: 'Your own account. Turn on two-step login and keep the recovery codes somewhere safe, away from your computer', use: 'Everything: it holds all of the above', recover: 'Cloudflare account recovery' },
  { name: 'Your password manager', where: 'Your own, outside Localdesk', use: 'Holds every password', recover: 'Set up emergency access with someone you trust' },
];

export const DOCS = [
  { id: 'launch-checklist', title: 'Before your first paying Books client', about: 'The short list, in order', body: `# Before your first paying client

1. **Register with HMRC for money laundering supervision.** Bookkeeping for other businesses needs it. Don't take a payment until it's done.
2. **Get the agreement and data addendum checked** by a professional, and add your name, address, ICO number and insurance details.
3. **Say "go"** and the Stripe payment link (£395 setup, £150 a month) is switched on.
4. **Add the new Books address** (books.localdeskai.co.uk/callback) as a redirect address in your Intuit developer account, then the permanent addresses are switched on.
5. **Test with a real UK QuickBooks trial** once Intuit has approved the live keys: connect it and run the setup check on the client's page.` },
  { id: 'owner', title: 'Owner guide: running Localdesk without Claude', about: 'Where everything is, how to log in, what to do if Claude stops', body: `# Owner guide

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
` },
  { id: 'start', title: 'How everything fits together', about: 'What you have, and that none of it needs Claude', body: `# Localdesk on one page

- **HQ** (this site) is your control room. You log in with your passphrase and a code from your phone app. It does not depend on Claude.
- **Books** is the bookkeeping service for tradespeople. Clients use an app on their phone that files receipts straight into their own QuickBooks.
- **Receptionist (Mia)** answers your customers' calls. It runs on Vapi (the voice) and Twilio (the phone numbers and texts).
- **Your website** is www.localdeskai.co.uk.
- **Money** goes through Stripe: customers, monthly payments and payouts to you.
- All of it sits in accounts that belong to you: Cloudflare, Stripe, Twilio, Vapi, GitHub and Intuit. If you stopped using Claude tomorrow, nothing would stop working.

## Three rules that protect you
1. Never send a password or key by email or chat. Type them only into Cloudflare, Stripe or your password manager.
2. Never put a password, key or customer detail into GitHub. It is a public website.
3. If you aren't sure, don't change it. Ask a developer to look at the Cloudflare account and the GitHub repository. Everything they need is there.` },
  { id: 'books-onboard', title: 'Taking on a new Books client', about: 'From ID check to their first receipt', body: `# Taking on a new Books client

1. **Before anything else:** check their ID and keep a copy in your own files. Get the agreement and data addendum signed and set up their payment.
2. In HQ, open **Books**, then **Add a new client**. Fill in the form and tap **Make the connect link**.
3. Send them the link on WhatsApp or by text, using the buttons on the next screen.
4. They open it, log in to their QuickBooks and tap **Allow**. They get their app link by text, and so do you.
5. Open their page in HQ and tap **Check their accounting setup**. If it lists anything, fix it in their QuickBooks before they start.
6. On a call, help them log in, tick the terms, snap one test receipt and add their accountant's email.

## When a client leaves
Open their page and tap **End their service**. Books stops straight away. Their data is held for 30 days and then deleted. Keep your own ID check for as long as the law requires.` },
  { id: 'setup-hq', title: 'Your HQ login: setting up and fixing', about: 'Passphrase, phone app, lost phone', body: `# Your HQ login

You log in with two things: your **passphrase** and a **6-digit code** from the authenticator app on your phone.

## If you've lost your phone
1. In Cloudflare open **Workers & Pages**, then **hq**, then **Settings**, then **Variables and Secrets**.
2. Change the variable **RESET_TOTP** to any new word and save.
3. Log in with your passphrase. HQ shows a new setup key for your new phone.

## If you've forgotten the passphrase
Edit **OWNER_PASSWORD** in the same place, type a new one, and save it in your password manager first. Every device is logged out.

## Locked out
Five wrong tries from one device locks that device for 15 minutes. Wait, then try again.` },
  { id: 'stripe', title: 'Connect Stripe (so HQ shows your money)', about: 'A read-only key, about 3 minutes', body: `# Connect Stripe

HQ only needs permission to look, never to change anything.

1. In Stripe go to **Developers**, then **API keys**, then **Create restricted key**. Name it "Localdesk HQ".
2. Set **Customers**, **Subscriptions**, **Charges** and **Invoices** to **Read**. Leave everything else on **None**.
3. Create the key and copy it.
4. In Cloudflare open **Workers & Pages**, then **hq**, then **Settings**, then **Variables and Secrets**, then **Add**. Type: **Secret**. Name: \`STRIPE_KEY\`. Paste the key as the value, then **Add variable and deploy**.
5. Reload HQ. Your customers and payments appear.

## When a payment fails
Stripe tries again automatically and emails the customer. If it's still unpaid after 14 days, phone them. After 30 days you can end their service, as the agreement says.` },
  { id: 'backups', title: 'Backups and restore', about: 'What is saved and how to bring it back', body: `# Backups

**What's saved:** your Books clients, their app links, mileage logs, the change log and notification settings. A backup is made every morning at about 6:30 and the last 30 are kept in HQ.

**What isn't saved, on purpose:** the links that connect to each client's QuickBooks (they are like passwords and they change every day, so an old copy is useless). After a restore each client reconnects with a fresh link.

**Their accounting data** is in their own QuickBooks. It isn't yours to back up.

## Keep your own copy
Once a week, open **Backups** in HQ, tap **Download a backup now** and save the file somewhere safe, like your password manager's secure notes.

## If you ever need to restore
This is a job for a developer: they send the backup file to Books' restore feature. Then send each client a fresh connect link from HQ.` },
  { id: 'deploy', title: 'Changing the Books software', about: 'For a developer: how updates go live and roll back', body: `# For a developer: updating Books

The code is in the GitHub repository (public: no secrets in it). The workers are uploaded to Cloudflare through its API. Only the website deploys automatically when \`main\` is pushed.

1. Run the tests: \`node --test test/*.test.mjs\` (all must pass) and the browser checks in \`test/browser/\`.
2. Download the live code first. That is the way back.
3. Upload the books worker, then the receipt-demo worker, keeping existing secrets.
4. Check the demo opens, HQ loads, and a new client link works.
5. To roll back, upload the saved copy of whichever worker broke.

The \`ops\` folder has setup scripts. Each prints its plan and changes nothing until run with \`--apply\`.` },
  { id: 'rotate', title: 'Changing a password or key', about: 'How to swap one safely', body: `# Changing a password or key

- **HQ passphrase:** edit \`OWNER_PASSWORD\` in Cloudflare (hq worker).
- **Books admin key:** set a new long random value as \`ADMIN_KEY\` on BOTH the books worker and the hq worker. The old one stops working at once.
- **Twilio, Stripe or Intuit:** create the new one in that service, put it in Cloudflare, then delete the old one in the service.

After any change, open HQ and check Home loads without warnings.` },
  { id: 'incident', title: 'If something goes wrong', about: 'Outage, a leak, and the 72-hour rule', body: `# If something goes wrong

## A client says Books isn't working
1. Open HQ Home. A problem shows as a red box with what to do.
2. Check Cloudflare and QuickBooks' own status pages.
3. If it started after an update, ask a developer to roll it back.

## Personal information may have leaked
1. Stop it from spreading, and write down the time you found out.
2. Decide whether people could be harmed. If so, you must tell the ICO within **72 hours** of finding out. Even if you decide not to, write down your reasons and keep them.
3. Tell your affected clients quickly. The data addendum says within 48 hours.

## A password or key may have leaked
Change it straight away (Help, "Changing a password or key"), then look at what it could have reached.` },
];
