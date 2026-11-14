# Lead · Yuvan (yuvanmuru-dev): manager + lead agent

You don't own a feature. You keep three builders unblocked and in sync, own the story (seed data + pitch), and drive the demo. Your Claude Code session is the **lead agent**: it answers the builders' agents, reviews their commits, and does the seed + pitch work.

## You own
`demo/seed/`, `pitch/`, `contracts/api.md`, `PLAN.md`, `AGENTS.md`, `handoff/`. You may take over `backend/agents/llm/root_cause.py` at 3:15 **only if Ishan asks**.

## Roster
| Label | Person | Role |
|---|---|---|
| `to-P1` | Ishan (Ish0212) | Backend + Dispute & Root-Cause agents (heaviest) |
| `to-P2` | rigshank | Capture service + Evidence Describer + tray photos |
| `to-P3` | saikarthikbattula | Next.js dashboard + phone alerts |

## Timeline
| Time | You | Lead agent (this session) |
|---|---|---|
| Before 2:00 | Make sure all 3 accepted the invite, cloned, ran `gh auth login`. Share the OpenAI key by DM. Confirm rigshank has the food. | — |
| **2:00** | Tell everyone to paste their brief's prompt. | Start the Q&A `/loop` (command in `handoff/README.md`). |
| 2:00–2:15 | Watch for the 2:15 stubs (P1 health + LLM stubs, P2 describer stub, P3 app shell). | Answer questions. |
| 2:15–3:15 | Ask the lead agent for `demo/seed/week.json` and the `pitch/` drafts. Check on people every ~20 min. | Answer questions; every ~15 min `git pull` and review new commits against the contract; send `to-P#` feedback for mismatches (field names, auth, event names). Build the seed + pitch. |
| **3:15** | Run the checkpoint: each person demos their piece in 1 min. Decide cuts (PLAN §6 cut list). If Ishan is behind on A5, the lead agent takes `root_cause.py`. | Post a `broadcast` with the decisions. |
| 3:15–4:00 | Integration: run all three services on one laptop (the demo laptop), walk the demo path, file bugs as `to-P#` issues. | Triage bugs, review fixes. |
| **4:00** | Freeze. Post the `broadcast`: "freeze, bug fixes only". | — |
| 4:30–5:00 | Rehearse twice (you drive and pitch). Record a backup video. | Final Q&A prep from `pitch/qa.md`. |

## Seed story (`demo/seed/week.json`, lead agent builds it)
Shape: contract §6. Story: PLAN §3.
- Nov 10–14, ~120 orders, 11:00–14:00 and 17:00–20:00 CT, ≈ 40% delivery, Stations 1–3; Station 2 runs ~2.3× its average volume 12:00–13:00.
- Tickets 100–219. **Fixed demo tickets:** `#139` (DoorDash, Station 2, 12:13, `fries_in_bag.jpg` → DISPUTE) · `#131` (Uber Eats, Station 2, 12:40, `no_fries_in_bag.jpg` → ACCEPT) · `#142` (status `new`, no evidence, for the live bump).
- 7 charges: 4 × fries Station 2 12:00–13:00 (2 with fries visible, 2 without), 1 missing drink with no evidence, 1 wrong item Station 1, 1 cold food on an order with a 6-min ready→handoff gap. Red herring: a Station 1 charge at 11:40.
- Descriptions pre-filled (no API calls at seed time). Swap in rigshank's real describer outputs when he posts them.
- Generator: `demo/seed/generate.py` with a fixed random seed, so it's re-runnable.

## Pitch (`pitch/`, lead agent drafts, you own the delivery)
- `outline.md`: ≤ 5 slides: the "$4 for missing fries" hook · zero extra work · Prove / Time / Learn · built on LLMSoftware's POS + camera + alerts · cost ≈ $2/day per location (estimate).
- `demo-script.md`: click by click from PLAN §7, with who's at the keyboard, plus a backup: recorded video + `capture --once` upload path if the webcam fails.
- `qa.md`: "Can't a human just check?" · "What if the camera can't see into the bag?" · "Privacy?" · "What if the restaurant really messed up?" · "How is this different from Agot / Loop / Otter?" · "Dispute windows?" · "Cost?"

## Reviewing commits (what the lead agent checks)
- Field names, event names, endpoint paths match `contracts/api.md`.
- Auth: HMAC on raw body, capture key, manager PIN, no secrets in client code or the repo.
- Nobody editing another person's directory.
- AI guardrails present: verdict rules in code, evidence IDs filtered, no staff names, stub mode without a key.
Feedback goes out as a `to-P#` issue with the file, line and a concrete fix. Never as a direct edit to their code.
