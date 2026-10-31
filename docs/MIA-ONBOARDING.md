# Onboarding a Receptionist client (the steps, and who does what)

Goal: from "yes" to live in about a day. Every change to Vapi or Twilio needs the owner's approval, one change at a time. Nothing is sent to a client without the owner sending it.

## 1. Before anything is built (owner, 10 minutes with the client)
- [ ] The client says yes to the 7-day free trial. Founding place available? Check HQ, Leads: "founding places reserved". If one is free, tick "Founding-client setup waiver applied" on the lead. If not, the 497 pound setup fee applies.
- [ ] Collect the facts into a client file (copy `ops/example-client.json`): business, trade, owner first name, services, areas, hours, quotes, emergencies, other. **No phone numbers in the file**: the repository is public. Keep the client's own mobile number in Vapi and Twilio only.

## 2. Check the facts offline (Claude or owner, no approval needed, calls nothing)
`python3 ops/new_client.py path/to/client.json --check`
It confirms every fact is filled in and short enough, that the finished assistant keeps the rules (no promised times or prices, 999 for danger, says it is an AI, tells callers the call may be recorded), and that call limits and the end-call tool are set. Fix anything it lists.

## 3. Build the assistant in Vapi (owner approves this one change)
`python3 ops/new_client.py path/to/client.json` creates or updates the assistant. It refuses to run if the file fails the checks above. Note the assistant id in HQ (lead notes), not in a public file.

## 4. Number and forwarding (owner approves each step separately)
- [ ] Attach a number to the assistant in Vapi or Twilio (a Twilio or Vapi change: approval first).
- [ ] Set the call-summary text to go to the client's own mobile (Vapi, with the summary worker's secret header).
- [ ] Client sets forwarding on their phone when they cannot answer. Give them the short instruction for their network. Keep their own number.

## 5. Test (owner, 15 minutes)
Run `docs/MIA-TEST-SCRIPT.md` completely. Fix and re-run anything that fails.

## 6. Go live and the trial
- [ ] Client does one real forwarded test call and sees the text.
- [ ] Tick "Live, and a test call made" on the lead and move it to Trial.
- [ ] Day 7: owner asks for the decision. If yes, **Make a payment link** in HQ (monthly price with the 7-day trial), the owner sends it. A non-founding client also owes the 497 pound setup fee: send it as a Stripe invoice when the trial ends (the terms say nothing is charged during the trial). Move to Paying only when Stripe shows the subscription paid.

## 7. First week
- [ ] Check the Vapi Calls page for this assistant on days 1, 3 and 7: calls look sensible, no stuck calls, cost per call small.
- [ ] Ask the client if any text was wrong or missing. Fix the file, re-run `--check`, ask approval to update the assistant.
