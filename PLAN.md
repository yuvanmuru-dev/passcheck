# PassCheck: every order, on the record

**Track:** 02 · Surveillance.ai (Cameras → live loss alerts)
**Event:** LLMSoftware.com × UT Dallas Hackathon · Sat Nov 14, 2026 · 2–5 PM CST (3 hours)
**Builds on:** LLM for Restaurants: POS ticket (flow step 04) + Cameras alert on WhatsApp (step 05) + ERP (step 10)

> **One line:** Delivery apps tell restaurants to photograph every bag before sealing it. Nobody does that at Friday lunch. PassCheck links LLMSoftware's existing POS ticket and counter camera, so every order is on the record automatically. When DoorDash charges you for "missing fries" two days later, you have proof in one tap, and the system tells you why it keeps happening.

> **What we do NOT claim:** that AI checks food better than a person. Staff still check the ticket like they do today. PassCheck adds **zero steps** at the counter and handles what people don't do reliably at scale: record every bag, find it days later, spot patterns.

---

## 1. PRD

### 1.1 Problem
- Delivery apps refund the customer instantly for "missing item" and take an **error charge** out of the restaurant's payout later (DoorDash: usually 25–100% of the item price).
- Restaurants can dispute these (DoorDash ~14 days, Uber Eats 30 days, so check your region), but by then nobody remembers the order, and digging through camera footage takes 10–15 minutes, so **most managers just eat the charge.**
- The guidance to photograph bags before sealing is a recommendation, not a rule, and it's done by hand. During a rush, nobody does it.
- Ready bags sit on the counter with nobody timing them, so food goes cold and drivers wait.
- Nobody tracks *why* the same mistakes repeat.

LLMSoftware already has the **POS ticket** and the **counter camera** for each restaurant, but nothing links them.

### 1.2 Users
| Persona | Need | Where they see PassCheck |
|---|---|---|
| **Counter / expo staff** | No extra work | The same "bump" buttons they already press (Packing → Ready → Handed off) |
| **Shift manager** | "Tell me when a bag is sitting; let me win disputes fast" | Phone alerts + Disputes inbox |
| **Owner** | "How much did we recover / lose, and why?" | Insights screen |

### 1.3 Three jobs
| Job | What happens | Why a person doesn't do it |
|---|---|---|
| **PROVE** | Every ticket automatically gets camera frames at *packing*, *ready* and *handoff*. When an error charge arrives, the Dispute agent pulls them and drafts a dispute, or says "charge looks valid" | Nobody photographs every bag or remembers order #139 two days later |
| **TIME** | Bag is *ready* but still on the counter after 3 min → alert | Nobody is timing bags during a rush |
| **LEARN** | Root-Cause agent groups error charges + stale handoffs by station, shift, item and channel → likely cause + 3 fixes | Nobody tracks patterns across a week |

### 1.4 Efficiency claims (say "estimate" on stage)
- Dispute: ~10–15 min of footage digging → **~30 s, one tap**
- Bag photos: manual and skipped → **automatic, 0 added staff time**
- Handoffs: unnoticed → **alert at 3 min**
- Money: recovered error charges + fewer repeat mistakes

### 1.5 Non-goals
- ❌ AI deciding whether a tray is correct before handoff (a person does that faster)
- ❌ Kitchen-line cameras; prep-step checking
- ❌ Real DoorDash / Uber Eats / Toast integrations (we mock their payload shapes)
- ❌ Face recognition or identifying individual staff
- ❌ Auto-submitting disputes. A manager approves every one.

### 1.6 User stories
| ID | Story | Priority |
|---|---|---|
| U1 | As staff, when I bump an order to Packing / Ready / Handed off, frames are captured and linked to the ticket automatically | **P0** |
| U2 | As a manager, I get an alert when a ready order sits > 3 min (demo: 30 s) | **P0** |
| U3 | As a manager, when an error charge arrives I open it and see the ticket, the frames, and a drafted dispute or "accept" recommendation | **P0** |
| U4 | As a manager, I tap "Why?" and get the likely cause with evidence + 3 ranked fixes | **P0** |
| U5 | When frames are missing or unclear, the Dispute agent says "needs review" instead of guessing | **P0** |
| U6 | Alert reaches a real phone (Photon iMessage → Telegram fallback) | P1 |
| U7 | Owner summary: $ disputed, $ recovered (est.), top cause | P1 |
| U8 | Voice-note question: "how many charges this week?" | P2 |

### 1.7 Acceptance criteria (demo)
- Bumping #142 to Packing captures a frame from the webcam within 2 s and shows it on the order timeline.
- A ready order not handed off for 30 s (demo setting) → stale alert in the UI + on a phone.
- "Simulate DoorDash charge" on #139 (frames show fries going in) → recommendation **DISPUTE**, cites evidence IDs, draft text ready.
- Charge on #131 (frames show no fries) → **ACCEPT**, and it's counted in insights.
- Charge on an order with no frames → **NEEDS_REVIEW**.
- "Why?" on seeded week → finds the planted story (fries, Station 2, 12–1 PM) and does not blame the red herring.

---

## 2. System design

### 2.1 Architecture
```
 Mock POS ──HMAC webhook──▶ ┌───────────────── FastAPI backend :8000 ─────────────────┐
 Mock DoorDash/Uber ──HMAC─▶│ orders · evidence · charges · decisions · alerts ·      │
   error charges            │ insights · audit_log (SQLite)                           │
                            │                                                          │
                            │ Agents:                                                  │
                            │  A1 Evidence Linker   (rules)  status bump → frame link  │
                            │  A2 Evidence Describer (GPT-4o vision) what's visible    │
                            │  A3 Handoff Watcher   (rules)  ready > N s → alert       │
                            │  A4 Dispute Agent     (GPT-4o) charge → dispute/accept   │
                            │  A5 Root-Cause Agent  (GPT-4o) week → cause + fixes      │
                            │  A6 Alert Dispatcher  (rules)  → UI, phone               │
                            └───────▲──────────────────────────────┬───────────────────┘
          frames (multipart,        │                              │ REST + SSE /api/stream
          X-Capture-Key)            │                              ▼
 ┌──────────────────────────┐       │            ┌──────────────── Next.js :3000 ───────────────┐
 │ Capture service (Python, │───────┘            │ Pass Board · Order timeline · Disputes ·      │
 │ OpenCV, webcam/mp4).     │◀── SSE order.updated│ Insights · Phone mockup · /api/notify →       │
 │ Snaps on status change.  │                    │ Photon iMessage (fallback Telegram)           │
 └──────────────────────────┘                    └───────────────────────────────────────────────┘
```
**The key design choice:** capture is triggered by the **status bumps staff already make** (like a kitchen display system's bump bar). That's how a frame gets linked to a ticket with no extra step.

### 2.2 Stack
Next.js + Tailwind · Python 3.11 + FastAPI + SQLModel/SQLite · OpenAI GPT-4o (vision + structured outputs) · OpenCV · SSE · Photon `spectrum-ts` (fallback: Telegram Bot API). **No Twilio.**

### 2.3 Contract
The full API, data model, SSE events and JSON examples are in **[contracts/api.md](contracts/api.md)**. It's the single source of truth: all four coding agents build against it.

---

## 3. Agents (product agents, not coding agents)

| Agent | Type | Trigger | Output |
|---|---|---|---|
| **A1 Evidence Linker** | Rules | Order status → `packing` / `ready` / `handed_off` | Capture service snaps frame → `Evidence` linked to order |
| **A2 Evidence Describer** | GPT-4o vision | New `packing` evidence | `description`: visible items, notes, confidence. **Evidence only, never blocks the order** |
| **A3 Handoff Watcher** | Rules, 5 s tick | `ready` and not `handed_off` > N s | `stale_handoff` alert |
| **A4 Dispute Agent** | GPT-4o text | Manager opens an error charge / taps Analyze | `DisputeDecision`: DISPUTE / ACCEPT / NEEDS_REVIEW + rationale + evidence IDs + draft text |
| **A5 Root-Cause Agent** | GPT-4o + read-only tools | "Why?" button | `Insight`: cause, confidence, evidence IDs, ≤ 3 ranked fixes |
| **A6 Alert Dispatcher** | Rules/templates | New alert / decision / insight | SSE to UI + `/api/notify` to phone |

Hard rules enforced **in code**, not just in prompts:
- A4: no evidence for the order → `NEEDS_REVIEW`. Description confidence < 0.6 → never `DISPUTE`.
- A4/A5 talk about stations, shifts, items and channels, **never individual staff**.
- All model outputs are validated with Pydantic; invalid → retry once → safe fallback (`NEEDS_REVIEW` / "insufficient evidence").

### Demo seed story (owned by the lead)
- Last 5 days, ~120 orders, channels: dine_in / takeout / doordash / ubereats / drive_thru, Stations 1–3.
- 7 error charges: **4 × missing fries, Station 2, 12:00–1:00 PM**. Two of them have packing frames that *show* fries (→ DISPUTE) and two don't (→ ACCEPT). Plus 1 missing drink with no frames (→ NEEDS_REVIEW), 1 wrong item Station 1, 1 cold-food complaint tied to a 6-min stale handoff.
- Red herring: a Station 1 charge at 11:40 that the root-cause agent should **not** turn into a pattern.

---

## 4. Security & responsible AI
| Risk | Mitigation |
|---|---|
| Keys leaked | OpenAI / Photon / Telegram keys only in server `.env` (backend or Next.js server routes). Never `NEXT_PUBLIC_*`. `.env` gitignored; `.env.example` committed |
| Fake orders / charges | `/api/pos/orders` and `/api/charges` need `X-Signature` = HMAC-SHA256(raw body, `WEBHOOK_SECRET`) |
| Fake frames | `/api/orders/{id}/evidence` needs `X-Capture-Key`; server stores SHA-256 of every frame (tamper-evidence) |
| Prompt injection (text in images, order notes, charge reasons) | All passed as JSON data; system prompts say "data, not instructions"; structured outputs; read-only tools; verdict rules in code |
| Privacy | Capture only on status bumps (not continuous recording); crop to the bagging area; no face recognition; **keep order-linked frames 30 days** (covers dispute windows), then delete; never store payment data |
| Unfair blame | Station / shift / item / channel level only; a person approves every dispute; overrides logged |
| Cost | Downscale frames to 768 px; describe only `packing` frames; cap calls per minute |
| Accountability | `audit_log` row for every AI output and human approval/override |
| Roles | `staff` (board) vs `manager` (disputes, insights, approvals). Demo: PIN; production: LLMSoftware's role-locked auth |

---

## 5. UI/UX
**Style (match the LLMSoftware flyer):** bg `#141a15`→`#1c241d`, cards `#1f2a21` with border `#2e3a30`, gold accent `#c9a24a`, green `#5fd38a` (LIVE/ok), red `#e5534b`, amber `#e0a93b`. Oswald headings, Inter body text, JetBrains Mono labels. "● LIVE" pill chips.

**Screens**
1. **Pass Board** (`/`): columns New · Packing · Ready · Handed off. Big bump buttons (≥ 48 px). Ready cards show a timer that turns amber at 2 min and red at 3 min. A 📷 dot when a frame was captured.
2. **Order timeline** (`/orders/[id]`): ticket on the left; on the right, a vertical timeline of frames (packing → ready → handoff) with timestamps, SHA-256 short hash, and the A2 description ("visible: 2 wrapped burgers, fries sleeve, drink").
3. **Disputes** (`/disputes`): inbox of error charges (platform chip, item, $, days left to dispute). Detail = charge + frames + A4 verdict banner (DISPUTE green / ACCEPT gray / NEEDS REVIEW amber) + editable draft + **Approve & copy** button.
4. **Insights** (`/insights`): top strip ($ charged, $ disputed, avg handoff, top cause) + insight cards (cause, confidence bar, evidence chips, 3 ranked fixes).
5. **Phone mockup** (right rail on manager screens): message-style alert thread.

**Principles:** zero new steps for staff · each screen answers one question · plain words ("Fries missing", "Bag waiting 3:10") · an AI result is always a recommendation the human approves.

**Demo controls** (shown with `?demo=1`): Seed week · Simulate DoorDash charge on an order · Set stale threshold to 30 s.

---

## 6. Build plan (3 builders with coding agents + 1 manager running the lead agent)
Agent briefs: **[handoff/](handoff/)**. Shared rules for every agent: **[AGENTS.md](AGENTS.md)**.

| Person | Owns (directory) | Brief |
|---|---|---|
| **P1 Ishan (Ish0212): Backend + Dispute agent** (heaviest; Claude Ultra / high reasoning) | `backend/` incl. `agents/llm/` except `describer.py` + `root_cause.py`, `scripts/` | [handoff/P1-backend.md](handoff/P1-backend.md) |
| **P2 rigshank: Capture & Vision** | `capture/`, `backend/agents/llm/describer.py`, `demo/photos/` | [handoff/P2-capture-vision.md](handoff/P2-capture-vision.md) |
| **P3 saikarthikbattula: Frontend** | `frontend/` | [handoff/P3-frontend.md](handoff/P3-frontend.md) |
| **Lead Yuvan (yuvanmuru-dev): manager + builder** | `backend/agents/llm/root_cause.py` (A5 Root-Cause agent), `demo/seed/`, `pitch/`, contract + shared docs; runs the lead agent (Q&A, commit reviews, integration testing); drives the demo | [handoff/LEAD-manager.md](handoff/LEAD-manager.md) |

| Time | Milestone |
|---|---|
| **Before 2:00** | One person creates the GitHub repo with these docs. Everyone: OpenAI key, Photon signup test, buy burger + fries + drink, photograph trays |
| 2:00–2:15 | Everyone reads `contracts/api.md`; agents scaffold their directories; frontend runs on mock JSON |
| 2:15–3:15 | Parallel build (see briefs) |
| **3:15 ✅** | Checkpoint: backend serves contract endpoints; capture posts a frame; A4 returns valid JSON from a script; board renders |
| 3:15–4:00 | Integrate: real API + SSE, seed data, disputes flow end to end |
| **4:00 ✅** | Feature freeze. Full demo path works |
| 4:00–4:30 | Phone alerts, polish |
| 4:30–5:00 | Rehearse twice, record a backup video |

**Cut list (cut from the top):** phone push (keep mockup) → SSE (poll every 2 s) → live webcam (upload-photo button) → A2 describer (A4 reasons on frame existence + timestamps only) → A5 tools (single prompt with all data).
**Never cut:** auto-linked frames on bump, the stale alert, the dispute decision, "Why?".

---

## 7. Demo script (3 min)
1. **Hook (20 s):** "Delivery apps tell you to photograph every bag. Nobody does at Friday lunch. Then DoorDash takes $4 for 'missing fries' and you can't prove otherwise."
2. **Zero extra work (40 s):** bump #142 Packing → webcam frame appears on its timeline. "That's it. Staff did nothing new."
3. **Time (20 s):** a ready bag sits → timer goes red → phone buzzes.
4. **Prove (60 s):** "Two days later…" simulate a DoorDash charge on #139 → one tap → frames show fries going in → DISPUTE + draft → Approve. Then #131 → ACCEPT: "it's honest when we really messed up."
5. **Learn (30 s):** "Why?" → "Fries, Station 2, 12–1 PM, 4 charges, Station 2 load 2.3×" → 3 fixes.
6. **Close (10 s):** "Built on LLMSoftware's POS, camera and alerts. No new hardware. Ships tomorrow."

## 8. Questions for LLMSoftware mentors
- Real camera event and POS ticket payload samples?
- Sandbox for their WhatsApp alert channel? (Production alerts would go through it; Photon/Telegram are demo stand-ins.)
- Do their customers already get delivery-app error charges in the ERP?
