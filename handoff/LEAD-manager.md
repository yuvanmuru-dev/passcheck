# Lead · Yuvan (yuvanmuru-dev): manager + builder

You build the **Root-Cause agent (A5)**, which is the "Why?" moment of the demo, and the seed data it runs on. You also keep three builders unblocked and in sync, and own the pitch and the demo. Your Claude Code session is the **lead agent**: it answers the builders' agents and reviews their commits between your build steps.

## You own
`backend/agents/llm/root_cause.py` (+ `fixtures/bundle_week.json`), `demo/seed/`, `pitch/`, `contracts/api.md`, `PLAN.md`, `AGENTS.md`, `handoff/`.

## Roster
| Label | Person | Role |
|---|---|---|
| `to-P1` | Ishan (Ish0212) | Backend + Dispute agent (heaviest) |
| `to-P2` | saikarthikbattula | Capture service + Evidence Describer + tray photos |
| `to-P3` | rigshank | Next.js dashboard + phone alerts |

## Timeline
| Time | You | Lead agent (this session) |
|---|---|---|
| Before 2:00 | Make sure all 3 accepted the invite, cloned, ran `gh auth login`. Share the OpenAI key by DM. Confirm saikarthikbattula has the food. | — |
| **2:00** | Tell everyone to paste their brief's prompt. | Start the Q&A `/loop`. Push the `run_root_cause` stub (contract §5) by 2:15. |
| 2:00–2:15 | Watch for the 2:15 stubs (P1 health + LLM stubs, P2 describer stub, P3 app shell). | Answer questions. |
| 2:15–3:15 | Build order: **seed `week.json` (by 2:45, since Ishan's fixtures depend on it) → A5 Root-Cause → pitch drafts.** Check on people every ~20 min. | Answer questions between build steps; every ~15 min `git pull` and review new commits against the contract; send `to-P#` feedback for mismatches (field names, auth, event names). |
| **3:15** | Run the checkpoint: each person (you too: A5 on `week.json`) demos their piece in 1 min. Decide cuts (PLAN §6 cut list). If Ishan is behind, pick up his Part A steps 10–11. | Post a `broadcast` with the decisions. |
| 3:15–4:00 | Integration: run all three services on one laptop (the demo laptop), walk the demo path, file bugs as `to-P#` issues. | Triage bugs, review fixes. |
| **4:00** | Freeze. Post the `broadcast`: "freeze, bug fixes only". | — |
| 4:30–5:00 | Rehearse twice (you drive and pitch). Record a backup video. | Final Q&A prep from `pitch/qa.md`. |

## Seed story (`demo/seed/week.json`, lead agent builds it)
Shape: contract §6. Story: PLAN §3.
- Nov 10–14, ~120 orders, 11:00–14:00 and 17:00–20:00 CT, ≈ 40% delivery, Stations 1–3; Station 2 runs ~2.3× its average volume 12:00–13:00.
- Tickets 100–219. **Fixed demo tickets:** `#139` (DoorDash, Station 2, Nov 11 12:52, `fries_in_bag.jpg` → DISPUTE) · `#131` (Uber Eats, Station 2, Nov 11 12:12, `no_fries_in_bag.jpg` → ACCEPT) · `#219` (status `new`, for the live bump) · `#218` (status `packing`). **Built:** see `demo/seed/README.md`.
- 7 charges: 4 × fries Station 2 12:00–13:00 (2 with fries visible, 2 without), 1 missing drink with no evidence, 1 wrong item Station 1, 1 cold food on an order with a 6-min ready→handoff gap. Red herring: a Station 1 charge at 11:40.
- Descriptions pre-filled (no API calls at seed time). Swap in saikarthikbattula's real describer outputs when they're posted.
- Generator: `demo/seed/generate.py` with a fixed random seed, so it's re-runnable.

## Your build: A5 Root-Cause agent (`backend/agents/llm/root_cause.py`)
Uses Ishan's `common.py` helper (`call_json`) once it's pushed; until then write a local one inside your file. Signature: contract §5. Standalone: `python -m backend.agents.llm.root_cause backend/agents/llm/fixtures/bundle_week.json` (build the fixture from `week.json`).

- **Count in code first** (LLMs miscount): charges by item / station / hour / channel / reason; each station's per-hour volume vs its average; stale handoffs by hour; disputed vs accepted. Send those aggregates **plus** the raw lists (capped: ≤ 200 orders, ≤ 50 charges, notes ≤ 500 chars).
- **System prompt essentials:** "Find the single most likely operational cause of these losses. Use only the data. Explain at station / shift / item / channel level, never individuals. A pattern needs at least 3 events. Give ≤ 3 recommendations, ranked, each doable today, with a rough $ or time impact. If the pattern is weak, cause = 'Insufficient evidence'."
- **Post-validation:** every ID in `evidence` must exist in the bundle (filter), ≤ 3 recommendations with priorities 1..n, confidence 0–1.
- **Acceptance on the lead's `week.json`:** names fries / Station 2 / lunch; does **not** turn the #104 Station 1 charge (~11:47) into a pattern.
- **Optional (only if ahead at 3:45):** tool-calling over the in-memory bundle (`count_charges(by)`, `station_load(station, hour)`, `stale_handoffs(hour)`).


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
