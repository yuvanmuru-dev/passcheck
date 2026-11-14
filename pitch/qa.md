# Judge Q&A: short, honest answers

**"Can't a human just check the bag?"**
Yes, and they still do. We don't replace that check. The problem is what happens *after*: nobody photographs every bag at lunch rush, nobody remembers order #139 two days later, nobody tracks patterns across a week. We add zero steps and cover those three.

**"The camera can't see inside a sealed bag."**
Right, which is why we capture at **Packing**, before it's sealed, when the bag is open on the counter. The capture is triggered by the bump button staff already press. If the frame is unclear, the dispute agent says "needs review" instead of guessing.

**"What if the restaurant really did forget the fries?"**
Then PassCheck says **accept the charge**. We showed that with #131. It's not a tool for fighting every refund. Those real misses feed the "Why?" analysis, which is where the actual savings are.

**"Privacy? You're filming staff."**
- Capture only happens on status bumps, not continuous recording, and frames are cropped to the bagging area.
- No face recognition, and the AI never names or scores individual staff, only stations, shifts and items.
- Frames are kept 30 days (covers dispute windows), then deleted.
- A manager approves every dispute.

**"How is this different from Agot, Loop or Otter?"**
Those exist and solve parts of this: vision at the pass, or automated chargeback disputes, as separate vendors. LLMSoftware's pitch is one platform instead of seven vendors, and it already has the POS ticket and the camera. We connected them inside their system. We're not claiming this has never been done; we're claiming it belongs in their platform.

**"Can restaurants actually dispute days later?"**
Yes. DoorDash's merchant docs mention about 14 days and Uber Eats about 30 days (it varies by region and by what the clock starts from: order, delivery or refund). That delay is exactly why an automatic record matters.

**"Is the AI deciding disputes?"**
No. It recommends one of DISPUTE / ACCEPT / NEEDS_REVIEW, cites the frames, and drafts the text. The manager approves. Hard rules in code: no frames → needs review; unclear frames → never dispute; cold food → never dispute (a photo can't prove temperature).

**"What does it cost?"**
Rough estimate ~$2/day per location at ~300 orders/day, mostly the vision call on packing frames. One recovered charge a day covers it. (Estimate from OpenAI list prices; real cost depends on model and volume.)

**"How do you know the root cause is right?"**
The counting is done in code, not by the AI, so the numbers are exact. The AI only explains them. It must cite real charge IDs, and it needs at least 3 related charges before it calls something a pattern. Otherwise it says "insufficient evidence."

**"Can't someone fake the photos?"**
Frames come from the restaurant's fixed camera, are tied to the POS ticket and timestamp, and are SHA-256 hashed on upload, so swapping one later is detectable. The upload endpoint needs a capture key.

**"What would you build next?"**
Plug into LLMSoftware's real WhatsApp alert channel instead of our demo stand-in; submit disputes straight to the DoorDash/Uber merchant portals once the manager approves; a weekly owner summary of dollars recovered.
