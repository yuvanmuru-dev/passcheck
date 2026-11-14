# P3: Frontend (Next.js dashboard + phone notify route)

> **Paste into your coding agent:**
> "You are P3, the frontend owner on PassCheck. Read `AGENTS.md`, `PLAN.md` (especially §5 UI/UX), `contracts/api.md`, then this file (`handoff/P3-frontend.md`). Build in the order below, commit after each step, and tell me what works after each milestone."

## You own
`frontend/`: Next.js (App Router, TypeScript, Tailwind). That includes the server route `/api/notify` that sends phone alerts.

## Target layout
```
frontend/
  app/
    layout.tsx               # fonts (Oswald, Inter, JetBrains Mono via next/font), dark theme, nav
    page.tsx                 # Pass Board
    orders/[id]/page.tsx     # Order timeline
    disputes/page.tsx        # Disputes inbox + detail panel
    insights/page.tsx        # Insights + stats strip
    api/notify/route.ts      # server-only: Photon → Telegram → none
  components/                # OrderCard, BumpButton, Timer, EvidenceTimeline, VerdictBanner, PhoneMockup, LivePill, DemoBar …
  lib/
    types.ts                 # TS types copied exactly from contracts/api.md §2
    api.ts                   # fetch helpers; adds X-Manager-Pin from localStorage
    stream.ts                # EventSource hook → falls back to polling every 2 s
    mocks/                   # JSON fixtures copied from the contract examples (use until backend is live)
  .env.example
```

## Build order
1. **Scaffold (by 2:15):** `npx create-next-app@latest frontend --ts --tailwind --app --eslint --no-src-dir`, theme tokens, fonts, nav, `lib/types.ts`, mock fixtures. Toggle `USE_MOCKS` in `lib/api.ts` so you never wait for the backend.
2. **Pass Board (`/`).** Four columns: New · Packing · Ready · Handed off. Each card: `#ticket`, channel chip (DoorDash red, Uber Eats green, others gray), station, item summary, a 📷 dot when `evidence_count > 0`, and **one big bump button** for the next status (`POST /api/orders/{id}/status`). Ready cards show a live timer (amber ≥ 2:00, red ≥ 3:00, or the current stale threshold). Updates live from SSE `order.*` events.
3. **Order timeline (`/orders/[id]`).** Left: ticket. Right: vertical timeline of evidence (packing → ready → handed off) with the image (`NEXT_PUBLIC_API_BASE + image_url`), time, short SHA-256 (first 8 chars), visibility chip and the description notes + visible items. Show a skeleton while `description` is null; fill in on `evidence.described`. Show any charges/decisions for the order.
4. **Disputes (`/disputes`).** Manager PIN prompt (store in localStorage). Inbox list: platform chip, `#ticket`, reason + items, `$amount`, **days left to dispute** (from `dispute_deadline`), status. Detail panel: charge + customer note, the order's frames, **Analyze** button → verdict banner (DISPUTE green / ACCEPT gray / NEEDS REVIEW amber) with confidence, rationale with evidence chips linking to frames, editable draft textarea, **Approve dispute** / **Accept charge** buttons → `/approve`, plus "Copy text".
5. **Insights (`/insights`).** Stats strip from `/api/stats` ($ charged, $ disputed, avg handoff, stale today, top cause). **Why?** button → `POST /api/insights/run` for the last 7 days → insight card: cause headline, confidence bar, reasoning, evidence chips, 3 ranked recommendations with impact.
6. **Phone mockup** (right rail on Disputes + Insights, also visible on board in demo mode): message-bubble list of alerts from SSE `alert.created`, newest at the bottom, with a little buzz animation for `high`. Ack button.
7. **Demo bar** (only when URL has `?demo=1`): Seed week (`/api/demo/seed`), Simulate charge (pick ticket + item + platform → `/api/demo/simulate-charge`), Stale threshold 30 s (`/api/demo/config`), and a "New order" button that posts a random order through a tiny Next.js server route that signs it with `WEBHOOK_SECRET` (server-side only, add it to `.env.local`).
8. **`/api/notify` route.** Check `X-Notify-Key`. Try Photon (`spectrum-ts`, stable SDK only; follow photon.codes/docs for sending one iMessage to `PHOTON_TO`), else Telegram (`POST https://api.telegram.org/bot<TOKEN>/sendMessage` with `chat_id`, `text`), else return `{sent:false, via:"none"}`. Never throw; 3 s timeout per provider.

## UX rules
- Dark theme from PLAN §5: bg `#141a15`, card `#1f2a21`, border `#2e3a30`, gold `#c9a24a`, green `#5fd38a`, red `#e5534b`, amber `#e0a93b`. Oswald headings, Inter body, JetBrains Mono labels/ticket numbers, "● LIVE" pill.
- Touch targets ≥ 48 px, high contrast, plain words ("Bag waiting 3:10", "Fries missing").
- Every AI result reads as a **recommendation**; a human button always makes the final call.
- Loading, empty and error states on every screen (e.g. "No charges yet. You're clean this week.").

## Security
- Only `NEXT_PUBLIC_API_BASE` is public. Photon/Telegram/notify/webhook secrets stay in server routes.
- Never render model text as HTML (no `dangerouslySetInnerHTML`).

## Checkpoint 3:15 (show your human)
All four screens render from mocks, the board bumps work against the real backend if it's up, and `curl -X POST localhost:3000/api/notify -H 'X-Notify-Key: dev-notify-key' -d '{"text":"test"}'` returns JSON (and buzzes a phone if Photon/Telegram is set).
