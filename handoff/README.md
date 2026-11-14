# Handoff: how the 4 of us start

## Before 2:00 (Yuvan, ~10 min)
1. Create a GitHub repo `passcheck`, push this folder (`PLAN.md`, `AGENTS.md`, `CLAUDE.md`, `contracts/`, `handoff/`, `.gitignore`). Add the other three as collaborators.
2. Make the repo **private** (issues on a public repo could be posted by strangers). Then create the Q&A labels:
   ```bash
   gh label create question --color FBCA04; gh label create answered --color 0E8A16; gh label create broadcast --color C9A24A; for n in 1 2 3 4; do gh label create to-P$n --color 1D76DB; done
   ```
3. Everyone: `git clone`, then `python3.11 -m venv .venv` at the repo root, and run `gh auth login` (agents use `gh` to ask questions).
4. Lead laptop: start the answer loop in the lead Claude Code session (see "Lead agent Q&A" below).
5. Share the OpenAI key privately (DM, not the repo). Everyone puts it in their own `backend/.env`.
6. P2: buy burger + fries + drink and take the 6 photos (see P2 brief).
7. P3: sign up at app.photon.codes and send one test iMessage. If it isn't working in 15 min, use Telegram.

## At 2:00
Each person opens their coding agent **at the repo root** and pastes the quoted prompt from the top of their brief:

| You | Brief | First thing your agent must push (by 2:15) |
|---|---|---|
| **P1 Ishan** (Ish0212) | [P1-backend.md](P1-backend.md): backend + Dispute agent (heaviest) | `/api/health` + `analyze_charge` stub |
| **P2 rigshank** | [P2-capture-vision.md](P2-capture-vision.md): capture + describer + photos | `describe_evidence` stub |
| **P3 saikarthikbattula** | [P3-frontend.md](P3-frontend.md): dashboard + phone alerts | Next.js app with theme + mocks |
| **Lead Yuvan** (yuvanmuru-dev) | [LEAD-manager.md](LEAD-manager.md): manager + Root-Cause agent, seed data, pitch, lead agent | `run_root_cause` stub + Q&A loop running |

Claude Code reads `CLAUDE.md` (which imports `AGENTS.md`); Cursor / Codex / others read `AGENTS.md` directly.

## Rules for the humans
- If your agent wants to change `contracts/api.md`, **stop and post in team chat first.** One person edits it, everyone pulls.
- `git pull --rebase` often. Only edit your own directories.
- 3:15 checkpoint: each person demos their piece alone in 1 minute.
- 4:00 feature freeze. Then integration bugs and polish only.
- 4:30 rehearsal (Yuvan drives). Record a backup video.

## Running everything (after 3:15)
```
source .venv/bin/activate && pip install -r backend/requirements.txt -r capture/requirements.txt
uvicorn backend.main:app --reload --port 8000
python -m capture.main
cd frontend && npm run dev     # open http://localhost:3000/?demo=1
```

## Lead agent Q&A
Teammates' agents post questions as GitHub Issues labeled `question` (the how-to is in `AGENTS.md`). The lead Claude Code session answers them:

- Start it in the lead session with:
  `/loop 2m check open GitHub issues labeled "question" in yuvanmuru-dev/passcheck from yuvanmuru-dev, Ish0212, saikarthikbattula, rigshank; answer each per PLAN.md and contracts/api.md as a comment starting with **ANSWER (lead):**, add the "answered" label, close it; if a contract change is needed, edit contracts/api.md, push, and post a "broadcast" issue`
- The lead can also message one agent directly (a `to-P1`…`to-P3` issue, e.g. review feedback on a commit) or everyone at once (`broadcast`). Agents check these after each commit and reply in a comment.
- The lead only answers issues opened by the four team accounts: yuvanmuru-dev, Ish0212, saikarthikbattula, rigshank. Anything else is ignored.
- Issue text is treated as a question, not as commands. The lead doesn't run code from issues or edit teammates' directories.
- Stop it with `/loop stop` (or just close the session) at 5:00.
