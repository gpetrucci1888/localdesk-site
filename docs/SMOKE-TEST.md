# HQ smoke test (about 10 minutes, owner on a phone or computer)

Only use your own test lead. Do not touch real leads. Nothing here contacts anyone or charges anything.

1. [ ] Log in to HQ. Open **Home**, **Leads**, **Customers**, **Payments**, **More**. No error pages.
2. [ ] **Leads**: you can see "founding places reserved" (0 of 5 unless you have ticked some) and the stages Called or contacted, Interested, Zoom booked, Demo attended.
3. [ ] **Add a lead**: name "Test Trader", your own mobile, business "Test Plumbing", interested in Receptionist, where from "test". Save.
4. [ ] Open Test Trader. In **Call plan**: Next action "Test", a Zoom date and time, a Zoom link starting `https://`, TPS "Checked: not registered". Save. Everything shows again after saving.
5. [ ] Change TPS to **Registered**. Save. The **Call button disappears** and a red "Do not cold call" notice shows.
6. [ ] Change TPS back, tick **They told me not to ring again**. Save. Same red notice, and the follow-up date and next action are cleared.
7. [ ] Move Test Trader to **Called or contacted**, then **Interested**, then **Zoom booked**. The history list shows each step.
8. [ ] **More, Content**: the draft posts show. Approve one, then use "Back to draft". Founding-offer posts show how many places are left.
9. [ ] **More, Stripe check** (if deployed): it says what is missing. Before Stripe is set up it should show red items, not an error page.
10. [ ] Optional: **More, Face ID login**, add your phone, log out, log in with a touch.
11. [ ] Delete Test Trader (Delete this lead, tick, Delete).

Pass: every line works and nothing was sent. Tell Claude any line that did not.
