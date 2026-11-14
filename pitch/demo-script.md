# Demo script (~2 min live, inside the 3-min pitch)

## Roles
| Who | Does |
|---|---|
| **Yuvan** | Talks the whole time. Never touches the keyboard. |
| **Ishan** | Drives the dashboard (he built it) and restarts anything that stalls. |
| **Karthik** | Packs the bag under the iPhone camera (P2: his capture); runs the `capture --once` backup if needed. |
| **Krish** (remote) | Before 4:00: runs `main` at home and walks steps 1–11 as a remote tester, filing bugs as `question` issues. |

## Setup (by 4:30, on the demo laptop)
1. `backend/.env` has the OpenAI key and `DEMO_MODE=true`.
2. Start: `uvicorn backend.main:app --port 8000` · `python -m capture.main` · `cd frontend && npm run dev`.
3. Open `http://localhost:3000/?demo=1`, enter manager PIN.
4. Demo bar → **Seed week** → board shows #218 in Packing, #219 in New.
5. Demo bar → **Stale threshold 30 s**.
6. Food on the counter under the webcam: open bag, burger, **fries**, drink.
7. Phone alerts are shown in the on-screen phone mockup (no real phone push in this build).
8. Second browser tab already open on **Disputes**, third on **Insights**.

## The run
| # | Yuvan says | Ishan clicks / Karthik does | Expected on screen |
|---|---|---|---|
| 1 | "This is a restaurant's counter. Order #219 just came in from DoorDash." | Board visible | #219 in **New** |
| 2 | "Staff start packing. They press the same button they always press." | Karthik puts food into the bag → Ishan taps **Packing** on #219 | 📷 dot on #219 within ~2 s |
| 3 | "That's it. That bag is now on the record." | Point at the 📷 on #219 (no order page in this build; the frame itself is shown in Disputes at step 8) | 📷 dot on #219 |
| 4 | "Bag's ready." | Back, tap **Ready** on #219, then **don't hand it off** | Timer starts |
| 5 | "But it's lunch rush and nobody picks it up…" | Wait ~30 s (talk through slide 3 meanwhile if needed) | Timer red, alert appears in the **on-screen phone mockup**: "Bag #219 ready … not handed off" |
| 6 | "Driver grabs it." | Tap **Handed off** | Moves to Handed off |
| 7 | "Two days later, DoorDash takes $3.99: 'missing fries'." | Demo bar → **Simulate charge**: #219, DoorDash, Fries, $3.99 | Charge appears in Disputes |
| 8 | "One tap." | Disputes tab → open it → **Analyze** | **DISPUTE**, cites the packing frame, draft ready |
| 9 | "Manager approves. Done in 30 seconds instead of digging through footage." | **Approve dispute** | Status disputed |
| 10 | "And it's honest when we really messed up." | Open seeded **#131** charge → **Analyze** | **ACCEPT**: frame shows no fries |
| 11 | "But *why* do fries keep going missing?" | Insights tab → **Why?** | Cause card: fries · Station 2 · 12–1 PM, Station 2 at ~4.4× volume, 3 fixes |
| 12 | "That's PassCheck." | Back to slides 4–5 | |

## Backups (decide fast, don't debug on stage)
| If… | Then… |
|---|---|
| Webcam / capture doesn't snap at step 2 | Karthik runs `python -m capture.main --once ord_219 packing --file demo/photos/fries_in_bag.jpg`. Keep talking. |
| Step 8 says NEEDS_REVIEW on #219 (live frame unclear) | "Live camera angle was off, so it refused to guess. That's the point." Then open seeded **#139** → Analyze → **DISPUTE**. |
| Phone doesn't buzz | Point at the phone mockup on screen: "Same alert goes to the manager's phone." |
| OpenAI slow or down | Dispute and Root-Cause both have no-key fallbacks; restart the backend without the key if needed. |
| Anything else dies | Play the backup video (record it at 4:30–4:45). |

## Timing check
Slides 1–3: 50 s · Demo steps 1–11: 110 s · Slides 4–5: 20 s → **~3:00**. Rehearse twice; cut step 10 if over time.
