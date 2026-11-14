# PassCheck frontend

Next.js (App Router, TypeScript, Tailwind). Talks to the backend in `contracts/api.md`.

```bash
cp .env.example .env.local   # only NEXT_PUBLIC_API_BASE, default http://localhost:8000
npm install
npm run dev                  # http://localhost:3000 (the backend's CORS allows this origin only)
```

- `/` Pass Board. Add `?demo=1` for the demo bar (Seed week, Stale threshold 30 s, Simulate charge) and the phone mockup. Tap a card to see its frames.
- `/disputes` Manager PIN, charge list, frames, Analyze, recommendation, editable draft, Approve dispute / Accept charge.
- `/insights` Stats strip and the **Why?** root-cause card (window 2026-11-10 to now).

The manager PIN is typed in the browser and kept in localStorage; it is never in the bundle or env.
Live updates come from SSE (`/api/stream`), one shared connection per tab, with a 2-second polling fallback.

Not built (cut in issue #6): order timeline page, `/api/notify` (Photon/Telegram), upload-photo button, signed "New order" button.
