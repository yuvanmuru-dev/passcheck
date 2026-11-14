# PassCheck contract (single source of truth)

Every coding agent builds against this file. **Do not change it on your own.** If a change is needed, tell the team in chat, have one person edit this file, push, and everyone pulls.

- Backend: `http://localhost:8000` (FastAPI). Frontend: `http://localhost:3000` (Next.js).
- All JSON. All timestamps **ISO 8601 UTC** with `Z` (`2026-11-14T18:14:05Z`). Money in **USD floats**, 2 decimals.
- IDs are strings with prefixes: `ord_`, `ev_`, `chg_`, `dec_`, `alt_`, `ins_`. Use `ord_<ticket_no>` for orders (e.g. `ord_142`) so demo IDs are readable. Others: prefix + 8 random hex chars.
- Errors: `{"error": {"code": "not_found", "message": "..."}}` with a matching HTTP status.
- CORS: allow `http://localhost:3000`.

---

## 1. Environment variables

`backend/.env` (copy from `.env.example`, never commit `.env`):
```
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
DATABASE_URL=sqlite:///./passcheck.db
WEBHOOK_SECRET=dev-webhook-secret        # HMAC for /api/pos/orders and /api/charges
CAPTURE_KEY=dev-capture-key              # X-Capture-Key for frame uploads
MANAGER_PIN=4242                         # X-Manager-Pin for manager endpoints
NOTIFY_URL=http://localhost:3000/api/notify
NOTIFY_KEY=dev-notify-key                # X-Notify-Key when backend calls the frontend notify route
STALE_THRESHOLD_S=180                    # demo sets 30 via /api/demo/config
DEMO_MODE=true                           # enables /api/demo/* endpoints
FRAME_RETENTION_DAYS=30
```
`capture/.env`: `BACKEND_URL=http://localhost:8000`, `CAPTURE_KEY=dev-capture-key`, `CAMERA_INDEX=0`, `VIDEO_FILE=` (optional mp4 instead of webcam), `ROI=` (optional `x,y,w,h` crop).

`frontend/.env.local`: `NEXT_PUBLIC_API_BASE=http://localhost:8000`, `NOTIFY_KEY=dev-notify-key`, `WEBHOOK_SECRET=dev-webhook-secret` (server routes only, for the demo "New order" button), `PHOTON_API_KEY=`, `PHOTON_TO=`, `TELEGRAM_BOT_TOKEN=`, `TELEGRAM_CHAT_ID=`. **Only `NEXT_PUBLIC_API_BASE` may be public.**

---

## 2. Data model (response shapes)

### Order
```json
{
  "id": "ord_142",
  "ticket_no": 142,
  "external_id": "toast_8f2a1c",
  "channel": "doordash",
  "station": 2,
  "items": [
    {"name": "Cheeseburger", "qty": 2, "price": 6.49, "modifiers": ["no onion"]},
    {"name": "Fries", "qty": 1, "price": 3.99, "modifiers": []},
    {"name": "Coke", "qty": 1, "price": 2.49, "modifiers": []}
  ],
  "total": 19.46,
  "status": "ready",
  "created_at": "2026-11-14T18:10:00Z",
  "packing_at": "2026-11-14T18:13:40Z",
  "ready_at": "2026-11-14T18:14:05Z",
  "handed_off_at": null,
  "evidence_count": 2
}
```
- `channel`: `dine_in | takeout | doordash | ubereats | drive_thru`
- `station`: integer 1–3
- `status`: `new → packing → ready → handed_off` (forward only; backend rejects other moves with 409)

### Evidence
```json
{
  "id": "ev_3fa91c0d",
  "order_id": "ord_142",
  "kind": "packing",
  "image_url": "/api/evidence/ev_3fa91c0d/image",
  "captured_at": "2026-11-14T18:13:41Z",
  "sha256": "9b1d…e04a",
  "source": "webcam",
  "description": {
    "visible_items": [{"name": "Cheeseburger", "qty": 2}, {"name": "Fries", "qty": 1}, {"name": "Coke", "qty": 1}],
    "visibility": "clear",
    "notes": "Open bag, two wrapped burgers, red fries sleeve, cup with lid.",
    "confidence": 0.84
  }
}
```
- `kind`: `packing | ready | handed_off`
- `source`: `webcam | video | upload | seed`
- `description` is `null` until the A2 describer finishes. `visibility`: `clear | partial | blocked`

### ErrorCharge
```json
{
  "id": "chg_a1b2c3d4",
  "order_id": "ord_139",
  "platform": "doordash",
  "reason": "missing_item",
  "items": [{"name": "Fries", "qty": 1}],
  "amount": 3.99,
  "customer_note": "No fries in the bag",
  "charged_at": "2026-11-16T15:02:00Z",
  "dispute_deadline": "2026-11-30T15:02:00Z",
  "status": "new"
}
```
- `platform`: `doordash | ubereats`. `reason`: `missing_item | wrong_item | cold_food | other`
- `dispute_deadline` = `charged_at` + 14 days (doordash) or 30 days (ubereats)
- `status`: `new → analyzed → disputed | accepted`

### DisputeDecision
```json
{
  "id": "dec_77e0aa12",
  "charge_id": "chg_a1b2c3d4",
  "recommendation": "DISPUTE",
  "confidence": 0.81,
  "rationale": "Packing frame ev_3fa91c0d (18:13:41) shows a fries sleeve going into the bag; bag was handed off sealed at 18:16:02.",
  "evidence_ids": ["ev_3fa91c0d", "ev_51c0d9e2"],
  "draft_text": "Order #139 (DoorDash) was packed on camera at 12:13 PM CT. Our packing image shows 1 order of fries placed in the bag before it was sealed…",
  "created_at": "2026-11-16T15:02:09Z",
  "approved_action": null,
  "approved_at": null
}
```
- `recommendation`: `DISPUTE | ACCEPT | NEEDS_REVIEW`
- `approved_action`: `null | disputed | accepted` (set by a manager)

### Alert
```json
{
  "id": "alt_0c9d8e7f",
  "type": "stale_handoff",
  "severity": "high",
  "order_id": "ord_142",
  "message": "Bag #142 (DoorDash) ready 3:10 and not handed off.",
  "created_at": "2026-11-14T18:17:15Z",
  "acked_at": null
}
```
- `type`: `stale_handoff | charge_received | decision_ready | insight_ready`
- `severity`: `low | med | high`

### Insight
```json
{
  "id": "ins_5e6f7a8b",
  "window_start": "2026-11-10T00:00:00Z",
  "window_end": "2026-11-14T23:59:59Z",
  "cause": "Fries missing on lunch delivery orders from Station 2",
  "confidence": 0.78,
  "reasoning": "4 of 7 error charges are fries; all Station 2; all 12:00–13:00 local; Station 2 order volume 2.3× its daily average in that hour.",
  "evidence": {"charge_ids": ["chg_…"], "order_ids": ["ord_131", "ord_139"], "alert_ids": []},
  "recommendations": [
    {"priority": 1, "action": "Add a fries checkpoint at the pass for delivery bags 12–1 PM", "est_impact": "~$16/week in charges"},
    {"priority": 2, "action": "Move one prep cook to Station 2 during lunch peak", "est_impact": "fewer misses, faster tickets"},
    {"priority": 3, "action": "Point the counter camera at the bagging area for Station 2 bags", "est_impact": "more disputes winnable"}
  ],
  "created_at": "2026-11-14T18:20:00Z"
}
```

### Stats
```json
{"charges_total_usd": 27.43, "disputed_usd": 7.98, "accepted_usd": 11.47, "pending_usd": 7.98,
 "avg_handoff_s": 96, "stale_count_today": 2, "top_cause": "Fries · Station 2 · lunch"}
```

---

## 3. Endpoints

Auth headers: **[HMAC]** `X-Signature: <hex HMAC-SHA256 of raw body with WEBHOOK_SECRET>` · **[CAP]** `X-Capture-Key` · **[MGR]** `X-Manager-Pin` · **[DEMO]** only when `DEMO_MODE=true`.

| Method | Path | Auth | Body → Response |
|---|---|---|---|
| POST | `/api/pos/orders` | HMAC | POS payload (below) → `Order` (201). Same `external_id` twice → 200 with existing order |
| GET | `/api/orders?status=&limit=50` | — | `{"orders": [Order]}` newest first |
| GET | `/api/orders/{id}` | — | `{"order": Order, "evidence": [Evidence], "charges": [ErrorCharge], "decisions": [DisputeDecision]}` |
| POST | `/api/orders/{id}/status` | — | `{"status": "packing"}` → `Order`. Sets `<status>_at`. Emits `order.updated` |
| POST | `/api/orders/{id}/evidence` | CAP | multipart `file` (jpeg/png ≤ 5 MB), `kind`, `source` → `Evidence` (201). Then A2 runs in background → `evidence.described` |
| GET | `/api/evidence/{id}/image` | — | image bytes |
| POST | `/api/charges` | HMAC | Charge payload (below) → `ErrorCharge` (201). Emits `charge.created` + `charge_received` alert |
| GET | `/api/charges?status=` | MGR | `{"charges": [ErrorCharge & {"order": Order, "decision": DisputeDecision\|null}]}` |
| POST | `/api/charges/{id}/analyze` | MGR | → `DisputeDecision` (runs A4). Emits `decision.created` |
| POST | `/api/charges/{id}/approve` | MGR | `{"action": "disputed"\|"accepted", "final_text": "..."}` → `DisputeDecision`. Writes audit log |
| GET | `/api/alerts?unacked=true` | — | `{"alerts": [Alert]}` |
| POST | `/api/alerts/{id}/ack` | — | → `Alert` |
| POST | `/api/insights/run` | MGR | `{"window_start": "...", "window_end": "..."}` → `Insight` (runs A5). Emits `insight.created` |
| GET | `/api/insights` | MGR | `{"insights": [Insight]}` |
| GET | `/api/stats` | MGR | `Stats` |
| GET | `/api/stream` | — | SSE (section 4) |
| POST | `/api/demo/seed` | DEMO | → `{"orders": n, "evidence": n, "charges": n}`. Wipes + loads `demo/seed/week.json` |
| POST | `/api/demo/simulate-charge` | DEMO | `{"ticket_no": 139, "platform": "doordash", "reason": "missing_item", "items": [{"name":"Fries","qty":1}], "amount": 3.99}` → `ErrorCharge` (unsigned shortcut for the demo) |
| POST | `/api/demo/config` | DEMO | `{"stale_threshold_s": 30}` → `{"stale_threshold_s": 30}` |
| GET | `/api/health` | — | `{"ok": true}` |

**POS webhook payload** (simplified Toast/Square shape):
```json
{"external_id": "toast_8f2a1c", "ticket_no": 142, "channel": "doordash", "station": 2,
 "items": [{"name": "Cheeseburger", "qty": 2, "price": 6.49, "modifiers": ["no onion"]}],
 "created_at": "2026-11-14T18:10:00Z"}
```
**Charge webhook payload** (simplified DoorDash/Uber shape):
```json
{"platform": "doordash", "ticket_no": 139, "reason": "missing_item",
 "items": [{"name": "Fries", "qty": 1}], "amount": 3.99,
 "customer_note": "No fries in the bag", "charged_at": "2026-11-16T15:02:00Z"}
```

**Frontend notify route** (owned by P3, called by backend A6):
`POST http://localhost:3000/api/notify` with header `X-Notify-Key`, body `{"text": "...", "severity": "high"}` → `{"sent": true, "via": "photon"|"telegram"|"none"}`. Must never throw: if no provider is configured, return `via: "none"`.

---

## 4. SSE events (`GET /api/stream`)
Format: `event: <name>\ndata: <json>\n\n`. Heartbeat comment `: ping` every 15 s.

| Event | Data |
|---|---|
| `order.created` | `Order` |
| `order.updated` | `Order` (the **capture service listens for this**: when `status` becomes `packing`, `ready` or `handed_off`, it snaps a frame) |
| `evidence.created` | `Evidence` |
| `evidence.described` | `Evidence` (with `description`) |
| `charge.created` | `ErrorCharge` |
| `decision.created` | `DisputeDecision` |
| `alert.created` | `Alert` |
| `insight.created` | `Insight` |

---

## 5. Python interfaces between backend and AI modules

P1 owns the backend and **calls** these. P2/P4 own them and **must push stubs with these exact signatures in the first 15 minutes** (returning the example output) so P1 can integrate immediately. Each module must work without an API key (return a canned stub plus `"stub": true` in the dict) so nothing blocks.

```python
# backend/agents/llm/describer.py   (owner: P2)
async def describe_evidence(image_path: str, order: dict) -> dict:
    """Return an Evidence.description dict: visible_items, visibility, notes, confidence."""

# backend/agents/llm/dispute.py     (owner: P4)
async def analyze_charge(charge: dict, order: dict, evidence: list[dict]) -> dict:
    """Return DisputeDecision fields except id/created_at/approved_*:
    recommendation, confidence, rationale, evidence_ids, draft_text."""

# backend/agents/llm/root_cause.py  (owner: P4)
async def run_root_cause(window_start: str, window_end: str, bundle: dict) -> dict:
    """bundle = {"orders": [Order], "charges": [ErrorCharge], "decisions": [DisputeDecision],
                 "alerts": [Alert], "evidence": [Evidence]}  (all within the window).
    Return Insight fields except id/created_at."""
```
Code-enforced rules (P4 implements inside the modules, P1 must not bypass):
- `analyze_charge`: if `evidence` is empty → `NEEDS_REVIEW`. If no `packing` evidence has `description.confidence >= 0.6` → never `DISPUTE`.
- Both LLM modules: validate output with Pydantic; on failure retry once; then return the safe fallback (`NEEDS_REVIEW` / cause `"Insufficient evidence"`).
- Never name individual staff.

---

## 6. Seed file (`demo/seed/week.json`, owner: P4, loaded by P1's `/api/demo/seed`)
```json
{
  "orders":   [ /* POS webhook payloads + "status", "packing_at", "ready_at", "handed_off_at" */ ],
  "evidence": [ {"ticket_no": 139, "kind": "packing", "captured_at": "...", "image": "demo/photos/fries_in_bag.jpg",
                 "description": { /* Evidence.description, pre-filled so seeding costs no API calls */ }} ],
  "charges":  [ /* charge webhook payloads */ ]
}
```
Image paths are relative to the repo root. P2 provides the photos in `demo/photos/`.
