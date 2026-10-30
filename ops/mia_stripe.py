#!/usr/bin/env python3
"""Receptionist (Mia) sign-up and payment: ONE Stripe Payment Link that charges the existing £497 setup price and the existing
£397/month Growth price in one checkout, plus the terms tick box. Uses the products already in Stripe: creates no new prices.
Dry run by default; --apply creates the link in LIVE Stripe (needs Gio's approval). Credentials come from the session proxy."""
import json, subprocess, sys, urllib.parse
APPLY = '--apply' in sys.argv
def call(method, path, data=None):
    cmd = ['curl', '-s', '-m', '30', '-X', method, 'https://api.stripe.com/v1' + path]
    if data: cmd += ['-d', urllib.parse.urlencode(data)]
    out = json.loads(subprocess.run(cmd, capture_output=True, text=True).stdout)
    if 'error' in out: sys.exit('Stripe said: ' + out['error'].get('message', '?'))
    return out
prices = call('GET', '/prices?limit=100&active=true')['data']
setup = next((p for p in prices if p['unit_amount'] == 49700 and not p.get('recurring')), None)
growth = next((p for p in prices if p['unit_amount'] == 39700 and (p.get('recurring') or {}).get('interval') == 'month'), None)
print('- setup price found:', bool(setup), '(£497 one-off)'); print('- monthly price found:', bool(growth), '(£397 a month)')
print('- Payment Link: both in one checkout, terms tick box (links to the Terms and Privacy pages), phone and address collected')
if not (setup and growth): sys.exit('Missing a price in Stripe; nothing to do.')
if not APPLY: print('\nDry run only. The £497 setup fee is waived for the first 5 founding clients on the website: apply a coupon or skip the setup line for those.'); sys.exit(0)
link = call('POST', '/payment_links', {'line_items[0][price]': setup['id'], 'line_items[0][quantity]': 1, 'line_items[1][price]': growth['id'], 'line_items[1][quantity]': 1,
  'billing_address_collection': 'required', 'phone_number_collection[enabled]': 'true', 'consent_collection[terms_of_service]': 'required',
  'custom_text[terms_of_service_acceptance][message]': 'I agree to the [Localdesk terms](https://www.localdeskai.co.uk/terms.html) and [privacy policy](https://www.localdeskai.co.uk/privacy.html).'})
print('Created:', link['url'])
