# Zoom demo flow (15 to 20 minutes), using the existing Mia setup

No Vapi or Twilio change is needed. A demo call costs pennies; check the Vapi balance first (docs/RECEPTIONIST-RELIABILITY.md).

**Before:** the prospect agreed to the Zoom on the phone. You have their trade, area and the sort of job they want calls for. Ring-test the demo line and the "Talk to Mia" button on the Receptionist page (or Vapi's Talk button) once.

| Minutes | Do |
|---|---|
| 0 to 2 | Thank them. Confirm what they want from the call. Say it is a demo, no obligation. |
| 2 to 5 | Their problem in their words: calls missed on site, voicemail, jobs lost. Do not exaggerate. |
| 5 to 10 | **Live call:** share your screen on the Receptionist page. Ring the demo line from your phone as a customer for their trade, or press "Talk to Mia". Let them hear her take name, number, address, job and urgency. Show the text summary arriving on your phone. |
| 10 to 13 | Show the sample call on the page. Be clear Mia is an AI and says so, calls may be recorded, and she never promises times or prices. |
| 13 to 16 | Price plainly: £397 a month, 7-day free trial; setup £497 (waived only if a founding place is free: check HQ). Say the rest before they decide, not after: 300 minutes a month included, extra minutes 25p, and after the free trial it is a 3 month minimum. Keep your own number, calls forward only when they can't answer. |
| 16 to 20 | Ask if they want to try it. If yes: agree the trial, note it in HQ (Demo attended, then Follow-up or trial or Signed up), set the next action. If no or not now: note why, set a date only if they want a follow-up. |

**After:** move the lead stage, save notes, and only message them if they agreed. Use "Make a payment link" only when they say yes, and send it yourself.

## Optional: a demo built for the prospect (a live phone change, so it needs your approval each time)
`python3 ops/new_client.py their-file.json --check` builds and checks their receptionist offline (no phone numbers in the file). Creating it in Vapi, and then pointing the 01752 demo line at it with `python3 ops/demo_line.py <assistantId>` (and back with `python3 ops/demo_line.py mia` afterwards), both change live Vapi settings. Each needs your explicit approval at that moment, one change at a time. Skip this for the first demos: the standard Mia demo is enough.

## Check once
The standard demo's greeting lives in Vapi, not in this repository, so it cannot be checked offline. Ring the demo line and confirm it tells callers the call may be recorded. If it does not, that is a change to make in Vapi (with your approval), because the website already tells visitors demo calls may be recorded.
