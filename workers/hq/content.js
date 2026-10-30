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
  { name: 'HQ passphrase (OWNER_PASSWORD)', where: 'Cloudflare: Workers > hq > Settings > Variables and Secrets. Your own password manager.', use: 'Logging in to this HQ', recover: 'Set a new one in Cloudflare; all HQ sessions end' },
  { name: 'HQ authenticator', where: 'Your phone\'s authenticator app', use: 'Second step of the HQ login', recover: 'Set a new value for RESET_TOTP in Cloudflare, then log in and enrol again' },
  { name: 'Books admin key (ADMIN_KEY)', where: 'Cloudflare secret on the books worker AND the hq worker', use: 'Lets HQ run Books admin actions for you', recover: 'Set a new value on both workers (Docs: Rotate a key)' },
  { name: 'QuickBooks app keys (QB_CLIENT_ID / QB_CLIENT_SECRET, production versions after approval)', where: 'Intuit developer dashboard; copied into the books worker secrets', use: 'Connecting clients\' QuickBooks', recover: 'Regenerate in Intuit, update the secret' },
  { name: 'Twilio account SID and auth token', where: 'Twilio console; copied into the books worker secrets', use: 'Login codes and text messages', recover: 'Rotate the auth token in Twilio, update the secret' },
  { name: 'Push notification keys (VAPID)', where: 'Public half: books worker setting. Private half: books worker secret only', use: 'Phone notifications', recover: 'Cannot be recovered. Generate a new pair; every client turns notifications on again' },
  { name: 'Stripe restricted read key (STRIPE_KEY)', where: 'Stripe: Developers > API keys; copied into the hq worker secret', use: 'HQ shows customers and subscriptions', recover: 'Delete the key in Stripe, make a new one' },
  { name: 'Vapi API key and assistant IDs', where: 'Vapi dashboard', use: 'Mia receptionist set-up scripts', recover: 'Regenerate in Vapi' },
  { name: 'Cloudflare login and API tokens', where: 'Your Cloudflare account (turn on two-step login). Any API token is made in Cloudflare', use: 'Everything', recover: 'Cloudflare account recovery. Keep recovery codes somewhere safe, away from your computer' },
  { name: 'Password manager and recovery codes', where: 'Your own, outside Localdesk systems', use: 'Holds every password above', recover: 'Set up emergency access with someone you trust' },
];

export const DOCS = [
  { id: 'start', title: 'Start here: running Localdesk without Claude', about: 'What exists, where it lives, who to ask', body: `# Localdesk, in one page

- **This HQ** (hq address): your private control room. You log in with a passphrase and an authenticator code. It does not depend on Claude.
- **Books** is two Cloudflare workers: the *books* connector (QuickBooks, texts, backups) and the *receipt-demo* app clients use on their phones. Code is in the GitHub repo under workers/.
- **Mia** (receptionist) runs on Vapi and Twilio. Vapi dashboard and Twilio console are linked on the Products page.
- **Website** is the public site, deployed from the GitHub repo main branch.
- **Money**: Stripe (customers, subscriptions, payouts).
- Everything is in your accounts: Cloudflare, GitHub, Stripe, Twilio, Vapi, Intuit. If you stop using Claude, none of it stops working. To change code later, any developer can use the repo and the docs here.

## Rules that protect you
- The repo is public. Never put secrets, customer details, phone numbers, access links or keys in it.
- Never send a password or key in a chat or email. Type secrets only into Cloudflare, Stripe or your password manager.
- Do not deploy the workers without testing: the repo has tests (see Books: deploy and rollback).` },
  { id: 'setup-hq', title: 'Setting up this HQ (one-off)', about: 'Passphrase, authenticator, address, backups', body: `# One-off setup

1. In Cloudflare open Workers, then the **hq** worker, then Settings, Variables and Secrets.
2. Add a secret **OWNER_PASSWORD**: a long passphrase (four or more random words) that exists only in your password manager.
3. Add a secret **ADMIN_KEY**: the same value as the Books admin key. (Add it to the books worker too if you rotate it.)
4. Optional: **STRIPE_KEY** (Docs: Connect Stripe).
5. Open the HQ address. Enter the passphrase. The first time, it shows a setup key: add it to an authenticator app by choosing "enter a setup key", then type the 6-digit code. From then on login needs the passphrase and a current code.
6. Save the passphrase and a note of the authenticator in your password manager. Keep the setup key as a recovery option.

## If you lose the authenticator
In Cloudflare, set a new value (any text) for the plain variable **RESET_TOTP** on the hq worker. The next login asks you to enrol again.

## If you forget the passphrase
Set a new OWNER_PASSWORD in Cloudflare. All sessions end.

## Lock-out
Five wrong tries from one place locks that place out for 15 minutes.` },
  { id: 'books-onboard', title: 'Books: taking on a new client', about: 'ID check, invite, first login, first checks', body: `# Taking on a Books client

1. Anti-money-laundering: ID check done and recorded in your own files, agreement and data processing addendum signed, payment set up (Stripe payment link).
2. Books admin (in HQ): New client. Business name, mobile (any normal UK format), practice or real QuickBooks, VAT yes or no, extras.
3. Send them the connect link. They sign in to QuickBooks and tap Allow. They are texted their app link. You are texted that they connected.
4. Run the pre-check (Books admin, client, Check): it tells you whether VAT codes, the bank account and expense accounts line up. Fix anything it lists in their QuickBooks.
5. They open the app, log in with a texted code, and tick the terms.
6. Snap one test receipt together, add their accountant's email.
7. Figures are on the cash basis. For an accrual client use the client settings.

## Ending a client
Books admin, client, End. Access stops at once. Their Books data is held 30 days then deleted (when deletion is switched to live). Keep your own ID record for as long as the law requires (check with your AML supervisor).` },
  { id: 'deploy', title: 'Books: deploy and rollback', about: 'How code gets live and how to undo it', body: `# Deploying Books

Workers are uploaded to Cloudflare with the API (not by pushing to GitHub). Only the website deploys on a push to main.

1. Run the tests: \`node --test test/*.test.mjs\` (all must pass) and the browser checks in test/browser/.
2. Save the live code first (Cloudflare API: download the worker content). That is your rollback copy.
3. Upload the books worker, then the receipt-demo worker. Keep secrets (keep_bindings: secret_text).
4. Check: the demo link opens, admin page loads, a new client link works.
5. Rollback: upload the saved copy of whichever worker broke. Takes about a minute.

Domain, VAT, billing and backup set-up scripts are in the ops folder of the repo. Each one prints a plan and changes nothing until you run it with --apply.` },
  { id: 'backups', title: 'Backups and restore', about: 'What is saved, where, and how to restore', body: `# Backups

**What is saved:** clients, their app links, mileage, change log, notification devices, shared links, chasing history.
**What is not saved, on purpose:** connection tokens (they are credentials and they rotate, so an old copy is useless), logins, codes, counters. After a restore each client reconnects with a new connect link.
**QuickBooks data** is not Books' to back up: it lives in each client's own QuickBooks.

## Daily
When a storage bucket named BACKUPS is connected to the books worker, a backup is written every morning and the last 30 are kept. Without the bucket, download a backup from the HQ Backups page every week and keep it in your password manager's secure notes or an encrypted drive.

## Restore
1. Books admin key needed (or ask a developer). POST the backup file to the books worker /restore (add ?overwrite=1 only if you mean to replace what is there).
2. Send each client a fresh connect link.
3. Practise a restore on a test copy before you need one.` },
  { id: 'stripe', title: 'Connect Stripe to HQ', about: 'A read-only key so HQ can show customers', body: `# Connect Stripe

1. Stripe dashboard, Developers, API keys, **Create restricted key**.
2. Give it read-only access to Customers, Subscriptions, Charges and Invoices. Nothing else.
3. Paste it into Cloudflare as the secret **STRIPE_KEY** on the hq worker. Never paste it anywhere else.
4. Reload HQ: customers and subscriptions appear.

## Billing for Books
£395 setup and £150 a month through one Stripe payment link (ops/books_stripe.py prints the plan). Failed payments: Stripe retries and emails the client; turn on Smart Retries and reminder emails in Stripe, Settings, Billing. If unpaid after 14 days, pause the client; after 30 days end the agreement (as the agreement says). Cancellations: the client uses the link in their Stripe receipt; it takes effect at the end of the month already paid.` },
  { id: 'rotate', title: 'Rotate a key', about: 'Changing a secret safely', body: `# Rotating a secret

- **Books admin key:** choose a new long random value. Set it as the ADMIN_KEY secret on the books worker AND the hq worker. Old value stops working at once.
- **Twilio token / Stripe key / Intuit secret:** create the new one in that service, update the secret in Cloudflare, then delete the old one in the service.
- **HQ passphrase:** set a new OWNER_PASSWORD. Sessions end.
After any rotation, open HQ and check the Overview loads.` },
  { id: 'incident', title: 'If something goes wrong', about: 'Outage, leaked data, 72-hour breach rule', body: `# If something goes wrong

## Books is down or a client says it is
1. HQ Overview: look for a client marked "needs attention".
2. Cloudflare status and QuickBooks status pages.
3. Roll back the last deploy (Docs: Books deploy and rollback).

## Personal data may have leaked (a breach)
1. Stop the leak. Write down the time you became aware.
2. Decide whether it risks people's rights and freedoms. If it does, report it to the ICO within **72 hours** of becoming aware. Even if you decide it does not, write down the assessment and your reasons.
3. Tell the affected clients (you are their processor): within 48 hours under the addendum.
4. Keep the record in your private notes.

## A key has leaked
Rotate it (Docs: Rotate a key) then look at what it could reach.` },
];
