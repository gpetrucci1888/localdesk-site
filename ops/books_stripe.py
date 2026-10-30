#!/usr/bin/env python3
"""Books billing in Stripe: one product, a £395 one-off setup price, a £150/month price, a Payment Link that charges both
(setup now, subscription from the same checkout), and a customer portal so clients can cancel or update their card.

Dry run by default: prints what it would create. Nothing is created without --apply, and it never touches the existing
Mia products. The Stripe key is injected by the session proxy (never put a key in this file).

  python3 ops/books_stripe.py            # show the plan
  python3 ops/books_stripe.py --apply    # create it (live mode: needs Gio's approval first)
"""
import json, subprocess, sys, urllib.parse

API = 'https://api.stripe.com/v1'
APPLY = '--apply' in sys.argv

def call(method, path, data=None):
    cmd = ['curl', '-s', '-m', '30', '-X', method, API + path]
    if data: cmd += ['-d', urllib.parse.urlencode(data, doseq=True)]
    out = json.loads(subprocess.run(cmd, capture_output=True, text=True).stdout)
    if 'error' in out: sys.exit('Stripe said: ' + out['error'].get('message', '?'))
    return out

def find_product():
    for p in call('GET', '/products?limit=100&active=true')['data']:
        if p['name'] == 'Localdesk Books': return p
    return None

plan = [
    'Product "Localdesk Books" (statement descriptor: LOCALDESK BOOKS)',
    'Price 1: £395.00 GBP one-off ("Books setup")',
    'Price 2: £150.00 GBP every month ("Books monthly")',
    'Payment Link: both prices in one checkout (subscription mode), collects name, email, phone and a billing address, card or Direct Debit if enabled on the account, no promotion codes, terms-of-service checkbox pointing at the Books terms',
    'Customer portal: customers can update their card and cancel at the END of the billing period (matches 30 days\' notice); invoices visible',
]
print('\n'.join('- ' + p for p in plan))
if not APPLY: print('\nDry run only. Re-run with --apply after approval.'); sys.exit(0)

prod = find_product() or call('POST', '/products', {'name': 'Localdesk Books', 'statement_descriptor': 'LOCALDESK BOOKS', 'description': 'Bookkeeping on QuickBooks for trades: setup plus monthly service'})
setup = call('POST', '/prices', {'product': prod['id'], 'currency': 'gbp', 'unit_amount': 39500, 'nickname': 'Books setup'})
monthly = call('POST', '/prices', {'product': prod['id'], 'currency': 'gbp', 'unit_amount': 15000, 'recurring[interval]': 'month', 'nickname': 'Books monthly'})
link = call('POST', '/payment_links', {
    'line_items[0][price]': setup['id'], 'line_items[0][quantity]': 1,
    'line_items[1][price]': monthly['id'], 'line_items[1][quantity]': 1,
    'billing_address_collection': 'required', 'phone_number_collection[enabled]': 'true',
    'consent_collection[terms_of_service]': 'required',
    'custom_text[terms_of_service_acceptance][message]': 'I agree to the [Books terms](https://www.localdeskai.co.uk/books/terms.html) and [privacy policy](https://www.localdeskai.co.uk/books/privacy.html).',
    'subscription_data[description]': 'Localdesk Books',
})
portal = call('POST', '/billing_portal/configurations', {
    'business_profile[headline]': 'Localdesk Books',
    'features[payment_method_update][enabled]': 'true', 'features[invoice_history][enabled]': 'true',
    'features[subscription_cancel][enabled]': 'true', 'features[subscription_cancel][mode]': 'at_period_end',
})
print('\nCreated. Payment link:', link['url'], '\nPortal configuration:', portal['id'], '\n(Send clients the payment link after the ID check. Their portal login link comes from Stripe: Customers > the customer > Create portal link.)')
