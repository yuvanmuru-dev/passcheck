# PassCheck pitch: 5 slides, ~1 min of slides + ~2 min live demo

Presenter: **Yuvan**. Keep slides minimal. The live demo is the pitch.

---

## Slide 1: The $4 problem
**Title:** "DoorDash just took $3.99 for fries you packed."
- Customer taps "missing fries" → refunded instantly → **error charge** comes out of the restaurant's payout days later.
- Delivery apps *recommend* photographing every bag before sealing it. **Nobody does that at Friday lunch.**
- So managers can't prove anything, and they eat the charge.

*Say:* "Every restaurant here has paid for fries they actually packed. And some fries really were missing, but nobody knows why it keeps happening."

## Slide 2: Zero extra work
**Title:** "Every order, on the record."
- LLMSoftware already has the **POS ticket** and the **counter camera**. Nothing connects them.
- PassCheck snaps a frame when staff press the bump buttons they **already** press: Packing → Ready → Handed off.
- Each frame is linked to its ticket, timestamped, and hashed (SHA-256) so it can't be quietly swapped.

*Say:* "We don't ask staff to do anything new. A person still checks the ticket. We just make sure every bag is on the record."

## Slide 3: Prove · Time · Learn
| | What happens | Why a person doesn't |
|---|---|---|
| **Prove** | Error charge arrives → one tap → frames + drafted dispute, or "this one's valid, accept it" | Nobody remembers order #139 two days later |
| **Time** | Bag ready but still on the counter → phone alert | Nobody times bags during a rush |
| **Learn** | "Why?" → cause + 3 fixes | Nobody tracks patterns across a week |

*Say:* "Then we show it live." → **switch to demo.**

## Slide 4 (after demo): Built on LLMSoftware
- Uses their POS integrations (Toast, Square, Clover…), their existing counter camera, their alert channel.
- No new hardware. A feature for their restaurant OS, not a new product.
- Human in control: the AI recommends, the manager approves every dispute. No face recognition, no staff names, frames kept 30 days to cover dispute windows.

## Slide 5: Why it's worth it (all estimates)
- **Dispute:** ~10–15 min of footage digging → **~30 seconds**.
- **AI cost:** ~**$2/day per location** at ~300 orders/day (estimate from OpenAI list prices).
- **Pays for itself** with one recovered charge a day.
- In our demo week: 4 of 7 charges traced to **one fixable cause** (fries · Station 2 · lunch rush).

*Close:* "Built on LLMSoftware's POS, camera and alerts. No new hardware. It could ship to a live restaurant tomorrow."

---

**Rules for the presenter**
- Say "estimate" for every time and $ figure. Don't claim AI checks food better than people. Don't claim nobody has done this before (see `qa.md`).
- Read numbers off the screen, not off this sheet: the app computes them from the data.
