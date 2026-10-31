# Review request: "Mia leaves these callers alone" (Receptionist, per client)

Date: 2026-10-31 | Requested by: Claude, at the owner's request | Status: DESIGN ONLY, nothing built, no phone config touched

## What the owner wants
A Receptionist client can name phone numbers (family, friends, suppliers, regular customers) that Mia must NOT answer. The client manages the list themselves; the owner must not be the middleman. It must not touch Books or need any Books login.

## Proposed design
1. **Storage:** a per-client list in the Books connector's Durable Object (new `skip:` keys), keyed by the Receptionist client, numbers normalised to E.164, max about 200 per client.
2. **Client self-service:** a private link per Receptionist client (random token, like the Books app link but a separate, Receptionist-only page and token) opening one page: list, add, remove. Optional later: text command "skip 07700 900123" to their Localdesk number (confirmation reply off by default because replies cost pennies).
3. **The check:** on every inbound call, before Mia answers, our worker compares the caller ID to that client's list. On a match the call is NOT given to Mia; it goes to the client's own mobile (default), or rings out, or plays a short message (per client setting).
4. **Mechanism (unverified):** Vapi can ask our server what to do with each inbound call (assistant-request style server URL) and our reply can pick the assistant or a destination number. This must be verified in Vapi's documentation and on the demo line before anything is promised. Changing the live phone setup needs the owner's approval.
5. **Fail-safe:** if the check errors or times out, Mia answers as today. A match never causes a call to be dropped silently.
6. **HQ:** read-only count per client only. The owner edits nothing.

## Risks I want challenged
- **Caller ID:** when a client forwards calls to us, some networks pass the original caller's number and some replace it with the client's own number. If replaced, the list cannot work for that client. We would test per network.
- **Withheld or unknown numbers** cannot be matched; they go to Mia.
- **Private-link security:** token length, no listing or enumeration, rate limiting, ability to rotate the link, what the page reveals.
- **Text command:** SMS sender IDs can be spoofed. Should we require the message to come from the client's registered mobile plus a confirmation, or skip the text command?
- **Abuse or mistakes:** a client adding too many numbers or a mistyped number sending real customers to their mobile.
- **Personal data:** the list holds third parties' phone numbers; retention, deletion when the client leaves, and wording in the privacy policy and data addendum.
- **Failure modes** I have missed.

## Specific questions
1. Is the fail-safe default (Mia answers on any error) right, or should a matched number fail differently?
2. Anything in the link-token approach you would change before it holds real customer numbers?
3. Is the text command worth the spoofing risk for a first version?
4. What is the smallest safe first slice to build (suggested: storage, link page, and the check as a pure function with tests, with NO live phone change)?

## Response (reviewer: reply on the PR with a line starting `Claude:` for anything you want me to act on)
