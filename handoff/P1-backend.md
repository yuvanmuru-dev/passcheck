# P1: Backend (FastAPI + SQLite + rules agents)

> **Paste into your coding agent:**
> "You are P1, the backend owner on PassCheck. Read `AGENTS.md`, `PLAN.md`, `contracts/api.md`, then this file (`handoff/P1-backend.md`). Build in the order below, commit after each step, and tell me what works after each milestone."

## You own
`backend/` except `backend/agents/llm/` (P2 owns `describer.py`, P4 owns the rest of `llm/`). You **call** their functions; you don't write them.

## Target layout
```
backend/
  __init__.py
  main.py            # FastAPI app, CORS, routers, startup (create tables, start watcher)
  config.py          # env loading (pydantic-settings)
  db.py              # SQLModel engine/session
  models.py          # SQLModel tables: Order, Evidence, ErrorCharge, DisputeDecision, Alert, Insight, AuditLog
  schemas.py         # Pydantic response models matching contracts/api.md exactly
  security.py        # verify_hmac, require_capture_key, require_manager_pin
  events.py          # in-process pub/sub → SSE
  routers/ orders.py evidence.py charges.py alerts.py insights.py stats.py demo.py stream.py
  agents/
    watcher.py       # A3 Handoff Watcher (rules)
    dispatcher.py    # A6 Alert Dispatcher (SSE + POST NOTIFY_URL)
    llm/             # NOT YOURS: import describe_evidence, analyze_charge, run_root_cause
  storage/           # saved frames (gitignored)
  __init__.py files  # backend/, backend/agents/, backend/routers/ (backend/agents/llm/__init__.py belongs to P2/P4)
  requirements.txt   # fastapi uvicorn[standard] sqlmodel pydantic-settings python-multipart httpx openai pillow
                     # + last line: -r agents/llm/requirements.txt  (P2/P4 add their deps there)
  .env.example
scripts/sign_and_post.py   # helper: sign a JSON file with WEBHOOK_SECRET and POST it (you own scripts/)
```

## Build order
1. **Scaffold (by 2:15).** App runs, `/api/health`, CORS for `localhost:3000`, tables created, `.env.example`. Push.
2. **Orders.** `POST /api/pos/orders` (HMAC, idempotent on `external_id`, id = `ord_<ticket_no>`), `GET /api/orders`, `GET /api/orders/{id}`, `POST /api/orders/{id}/status` (forward-only transitions, set `<status>_at`, 409 otherwise).
3. **Events + SSE.** `events.publish(name, data)`; `GET /api/stream` using `StreamingResponse` with `text/event-stream`, a per-client `asyncio.Queue`, and a `: ping` every 15 s. Publish `order.created/updated` etc. exactly per contract §4.
4. **Evidence.** `POST /api/orders/{id}/evidence` (capture key, jpeg/png ≤ 5 MB, verify with Pillow, downscale to max 768 px, save to `backend/storage/<id>.jpg`, compute SHA-256 of stored bytes). Return `Evidence` with `description: null`, publish `evidence.created`, then in a background task call `describe_evidence(path, order)` → save → publish `evidence.described`. `GET /api/evidence/{id}/image`.
5. **Charges + A4.** `POST /api/charges` (HMAC; look up order by `ticket_no`; compute `dispute_deadline` = +14 d doordash / +30 d ubereats) → publish `charge.created` + create a `charge_received` alert. `GET /api/charges` (manager; embed `order` + latest `decision`). `POST /api/charges/{id}/analyze` → call `analyze_charge(charge, order, evidence)` → store `DisputeDecision`, set charge `analyzed`, publish `decision.created`, create a `decision_ready` alert. `POST /api/charges/{id}/approve` → set `approved_action/approved_at`, charge status `disputed|accepted`, audit log.
6. **A3 Handoff Watcher.** Background task every 5 s: orders with `status=ready` and `now - ready_at > stale_threshold_s` and no existing `stale_handoff` alert → create alert (`severity` high) with message like `Bag #142 (DoorDash) ready 3:10 and not handed off.`
7. **A6 Dispatcher.** Every alert: save, publish `alert.created`, then `httpx.post(NOTIFY_URL, headers={"X-Notify-Key": ...}, json={"text": message, "severity": ...}, timeout=3)`, swallowing errors (never crash on notify failure).
8. **Insights + stats.** `POST /api/insights/run` → build `bundle` (orders/charges/decisions/alerts/evidence inside the window) → `run_root_cause(...)` → store, publish, `insight_ready` alert. `GET /api/insights`, `GET /api/stats` (compute from charges/decisions/orders).
9. **Demo endpoints** (only if `DEMO_MODE`): `/api/demo/seed` (wipe tables, load `demo/seed/week.json`, copy images into storage with SHA-256, keep pre-filled descriptions, **no LLM calls**), `/api/demo/simulate-charge` (same logic as `/api/charges`, unsigned), `/api/demo/config`.
10. **Audit log.** One row for every LLM output (describe / analyze / root cause) and every approve: actor, action, input SHA-256, output JSON, timestamp.
11. **Retention.** On startup, delete evidence older than `FRAME_RETENTION_DAYS` (seed data is exempt: mark `source="seed"`).

## Security checklist (must all be true)
- [ ] HMAC: `hmac.compare_digest(hex(hmac_sha256(WEBHOOK_SECRET, raw_body)), X-Signature)`, read the **raw** body before parsing.
- [ ] Capture key and manager PIN compared with `compare_digest`; 401 on failure.
- [ ] Upload: content-type + Pillow verify, size cap, server-generated filenames only (never use the client filename).
- [ ] Text fields capped (customer_note ≤ 500 chars, item names ≤ 80, modifiers ≤ 10).
- [ ] No secrets in logs or error messages.

## Checkpoint 3:15 (show your human)
`scripts/sign_and_post.py` posts an order → `curl localhost:8000/api/orders` shows it → status bump emits SSE (`curl -N localhost:8000/api/stream`) → frame upload works with the capture key → simulate-charge + analyze returns a stub decision.

## Integration notes
- Until P2/P4 push real modules, their stubs return `"stub": true`; just store the fields defined in the contract and ignore extra keys.
- P3's frontend will hit you from the browser, so CORS must allow `http://localhost:3000` with headers `X-Manager-Pin`, `Content-Type`.
