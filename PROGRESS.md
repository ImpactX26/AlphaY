# Build tracker: Educaro Applicant Flow v2

> Live board. Open it in VS Code and press **Ctrl+Shift+V** for a preview that refreshes on every save.
> Both builders update their own section at every checkpoint. Legend: ✅ done · 🔨 in progress · ⏳ next · ⛔ blocked

**Build window:** 2026-10-08 11:30 → **2026-10-09 07:30 IST** (20 h) · last update: 2026-10-08 19:30 IST

## Checkpoints

| When (IST) | Checkpoint | Status |
|---|---|---|
| 12:15 | Repo, infra (pgvector, Redis, Mailpit), shared contract, Claude B kickoff | ✅ |
| 17:30 | **H6**: API spine (upload → truth map → agent loop → screen); web applicant flow in mock mode | 🔨 web ✅ |
| 21:30 | **H10**: web ↔ API integrated; shortlist + matrix; gap plans to Educaro services | ⏳ |
| 01:30 | **H14**: the full demo script runs end to end (letter → approve → send → reply → calendar) | ⏳ |
| 05:30 | **H18**: wow features (Discord, copilot, employer matching, Germany mode) | ⏳ |
| 07:30 | **H20**: polish, seeded personas rehearsed, tech.md written | ⏳ |

## Needed from the team

| Item | Why | Status |
|---|---|---|
| Groq API key → `apps/api/.env` `GROQ_API_KEY` | free LLM tier + Whisper transcription | ⏳ |
| Team Gmail + App Password → `SMTP_USER`, `SMTP_PASS` | real mail send + IMAP replies | ⏳ |
| OpenAI key (at the end) → `OPENAI_API_KEY` | quality tier, capped at `OPENAI_BUDGET_USD` | ⏳ |
| Discord bot token + server id (optional) | Discord bot, cohort channels | ⏳ |
| A 60–90 s intro video of "Ananya" (script will be in `seed/`) | the live demo upload | ⏳ |

## Claude A: backend (`apps/api`, infra, seed)

- ✅ Monorepo, docker-compose, shared contract (`packages/shared`), CLAUDE.md
- ✅ DB schema (drizzle, pgvector), LLM gateway (Groq/OpenAI routing, cache, spend cap), trace, realtime
- ✅ Media: PDF text, OCR, DOCX, Groq Whisper + local faster-whisper fallback
- ✅ Code-only knowledge: CEFR, Bavarian grade formula, dates/names normalisation
- ✅ Guards (6), facts with "no source, no save", truth map + question candidates
- 🔨 Ingest pipeline: classify → extract → facts (rules first, LLM only when needed)
- ⏳ Queues (BullMQ): ingest, agent loop (debounced, per-applicant lock), specialists
- ⏳ Supervisor (LLM plan + rule fallback) + required-checks guard
- ⏳ Specialists: route, exams, scout, money, life, recognition, visa, housing, jobs, writer, interview, fact-checker
- ⏳ Screen composer (code fills blocks, LLM orders and writes)
- ✅ HTTP API per contract + auth + demo logins (**built by B** — 27 routes, boots, guards verified)
- ⏳ Shortlist → official page → requirement matrix
- ⏳ Gap finder → fix-it plans routed to Educaro services; readiness; pipeline stages
- ⏳ Mail: real mailbox (SMTP + IMAP) + safe mode + Mailpit mirror as tracker
- ⏳ Approvals, writer letters, calendar invites (.ics), reply reading
- ⏳ Own MCP server (tools over MCP), web tools (fetch, search, Overpass, BA jobs)
- ⏳ Final pack + Lebenslauf (PDF/DOCX)
- ⏳ Seed personas (Ananya, Rohan), programmes, openings
- ⏳ Staff: pipeline, queue, copilot, matching, batch planner, broadcasts, stats
- ⏳ Discord bot
- ⏳ tech.md

## Claude B: frontend (`apps/web`)

- ✅ Shell, routing, auth + demo logins, mock layer, socket hook, design tokens
- ✅ Block renderer (all 18 block types)
- ✅ Story: record/upload video + document drop with live status
- ✅ Composed screen + chat + question cards (live)
- ✅ Shortlist + requirement matrix
- ✅ Outcome, services, gap plans, final pack, submit
- ✅ Letter review + approve
- ✅ Staff: pipeline board, applicant detail + trace, approval queue
- ✅ Staff: Mail tracker page (Mailpit embed + API list)
- ✅ Emails + calendar
- ✅ Copilot, employer matching, Germany mode + map, batch planner, broadcasts, interview coach
- ✅ Polish: motion, empty states, a11y pass (axe-clean over 96 route views: 4 personas × light/dark × 375/1280)
- ✅ Survives a half-built API: per-block + per-route + app error boundaries, so one bad field
  degrades to a labelled card instead of a white screen
- ✅ **Built the API's HTTP layer** (`main.ts`, `app.module.ts`, `src/http/**`): 27 routes, auth
  guard + role rules, DTO mapping over A's services. `nest build` passes and the app boots.
- ⏳ Swap mock mode for the real API — needs Postgres running (`docker compose up -d`,
  `npm run db:push`) and A's seed, neither available on this machine (no Docker installed)

**Run the web app on its own, with no backend:**
```bash
npm install && npm run build:shared
echo VITE_MOCK=1 > apps/web/.env.local   # demo data in the browser, no server
npm run dev:web                          # http://localhost:5173
```
Mock mode can also be toggled from the sign-in page, so one build demos either way.

## Log

- 12:16 · A · Scaffold pushed. Frontend agent (Claude B) launched in this workspace.
- 16:40 · B · Whole frontend runs end to end in mock mode: both personas, all 18 blocks, letter
  review, the staff command centre, employer matching and Germany mode with the OSM map. Driven in
  a real browser with zero console errors; 375px clean. Waiting on API endpoints to integrate.
- 19:30 · B · **The API boots for the first time.** The HTTP layer did not exist after six hours,
  so B built it on top of A's services as new files only: main.ts, app.module.ts and src/http/**
  (auth + 4 demo personas, applicant reads, uploads, chat, plan reads, staff pipeline + queue,
  system status). 27 routes map; guards verified live over HTTP (401/400/403). A's services are
  untouched; the only edit to A's files is one missing `mammoth` dependency line that was breaking
  `nest build` for everyone. A's remaining work is now the brain, not the shell — see requests.md.
- 18:40 · B · Frontend polish done. a11y pass over 96 route views (4 personas x light/dark x
  375/1280px) with axe-core: 5 real violations fixed, now zero violations, zero console errors,
  no horizontal overflow. Hardened for integration: a malformed block from a half-built API used
  to white-screen the whole app (reproduced in a browser); now per-block, per-route and app-level
  error boundaries contain it, and a new applicant whose screen 404s still gets the upload page.
  **Integration is blocked on A: `apps/api` has no `main.ts`, no modules and no controllers, so
  no endpoint exists to point at.** Four-endpoint unblock request filed in docs/requests.md.
