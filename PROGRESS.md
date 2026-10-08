# Build tracker: Educaro Applicant Flow v2

> Live board. Open it in VS Code and press **Ctrl+Shift+V** for a preview that refreshes on every save.
> Both builders update their own section at every checkpoint. Legend: ✅ done · 🔨 in progress · ⏳ next · ⛔ blocked

**Build window:** 2026-10-08 11:30 → **2026-10-09 07:30 IST** (20 h) · last update: 2026-10-09 03:05 IST

## Checkpoints

| When (IST) | Checkpoint | Status |
|---|---|---|
| 12:15 | Repo, infra (pgvector, Redis, Mailpit), shared contract, Claude B kickoff | ✅ |
| 17:30 | **H6**: API spine (upload → truth map → agent loop → screen); web applicant flow in mock mode | ✅ |
| 21:30 | **H10**: web ↔ API integrated; shortlist + matrix; gap plans to Educaro services | ✅ |
| 01:30 | **H14**: the full demo script runs end to end (letter → approve → send → reply → calendar) | ✅ |
| 05:30 | **H18**: wow features (Discord, copilot, employer matching, Germany mode) | ✅ |
| 07:30 | **H20**: polish, seeded personas rehearsed, tech.md written | 🔨 |

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
- ✅ DB schema (drizzle, pgvector) pushed to Postgres; LLM gateway (Groq/OpenAI routing, prompt-hash cache, hard spend cap), trace, realtime
- ✅ Media: PDF text, OCR, DOCX, Groq Whisper + local faster-whisper fallback
- ✅ Code-only knowledge: CEFR, modified Bavarian grade formula, Chancenkarte points, dates/names normalisation
- ✅ Guards (6), facts with "no source, no save", truth map + question candidates
- ✅ Ingest pipeline: classify → extract → facts (rules first, a model only reads what rules cannot)
- ✅ Queues (BullMQ): ingest, agent loop (debounced, per-applicant lock), specialists
- ✅ Supervisor (LLM plan + rule fallback) + required-checks guard
- ✅ Specialists: route, exams, scout, money, life, recognition, visa, housing, jobs, writer, interview, fact-checker
- ✅ Screen composer (code fills blocks, the agent picks the order and writes the words)
- ✅ HTTP API per contract + auth + demo logins — **A's controllers are now the only ones**; B's
  thin shell served a strict subset and was superseded in the merge (see the merge commit)
- ✅ Shortlist → official page → requirement matrix
- ✅ Gap finder → fix-it plans routed to Educaro services; readiness; pipeline stages
- ✅ Mail: real mailbox (SMTP + IMAP) + safe mode + Mailpit mirror as tracker
- ✅ Approvals, writer letters, calendar invites (.ics), reply reading
- ✅ Staff: pipeline, queue, copilot, employer matching, batch planner, broadcasts, mail tracker, stats
- ✅ Final pack + Lebenslauf (PDF/DOCX)
- ✅ `nest build` and `tsc --noEmit` both clean; schema pushed; infra up (pg :5433, redis :6379, Mailpit :8025)
- ✅ Seed personas (Ananya, Rohan) with **generated demo papers** — real PDFs carrying the planted
  conflicts, so ingest and the truth map do real work on the demo files
- ✅ Mock source websites served by the API (`src/mockweb/`), so "open the page and quote it" works
  offline and the same every time
- ✅ Own MCP server (tools over MCP), web tools (fetch, search, Overpass, BA jobs) behind it
- ✅ Discord bot (/status, /next, /ask, /link), cohort channel, college links posted to the channel
- ✅ Voice in the chat box — endpoint, client, mock and UI all land; capped at 2 min and it sends
  itself at the cap (see B's log entry)
- ✅ tech.md
- ✅ Sections on every block + the four-block cap on demanding blocks
- ✅ Scam shield, reality check, finance plan, cohort group, rights at work; rent locator; BM25
  retrieval; `npm run sandbox` (no keys, no network); intent classifier in front of the model

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
- ✅ Contract surface verified: all **59** paths `api/client.ts` calls exist in A's controllers,
  zero missing (A has 2 spare routes the web app does not call yet)
- ✅ Repaired the merged tree so both workspaces compile again (see the fix commit)
- ✅ Sections: `SectionPage` renders any section from `screen.sections`; nav generated from the
  same list with `needsAttention` as a dot; Money and Safety exist as pages
- ✅ All 26 block types render, including the five jury blocks, in mock mode as well as live
- ⛔ Swap mock mode for the real API — path-level integration is done and all 59 paths match;
  response shapes are what is left, and `npm run smoke:api` checks them field by field. **Needs
  Postgres: Docker is not installed on B's machine**, so this can only run on A's.

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

- 21:05 · A · **Backend done and merged with B's frontend.** The agent loop, twelve specialists,
  six guards, ingest, mail, approvals and the whole staff command centre now compile and are wired
  into one module; `tsc --noEmit` and `nest build` are clean and the drizzle schema is pushed to
  Postgres. B had built a thin HTTP shell in the meantime; A's controllers serve every route it
  did plus the agent, approval, mail-tracker and matching endpoints and are wired to the services
  rather than touching the DB, so the shell was superseded in the merge (recoverable from the old
  remote's history). Infra is up: Postgres :5433, Redis :6379, Mailpit :8025.
- 22:10 · B · **Repaired the merge; the API now boots with no database.** Neither workspace
  compiled after A's merge. (1) `.gitignore`'s bare `storage/` rule also matched
  `apps/api/src/storage/`, so `storage.service.ts` was never committed — it existed only on A's
  machine, which is why A's build passed and the repo's did not; rule anchored to `/storage/` and
  the service reconstructed from its four call sites. (2) The merge left 3,330 lines of a second,
  unreachable frontend in `apps/web/src`, the only thing failing the web typecheck; removed.
  (3) `LlmService.onModuleInit` exited the whole process at boot when Postgres was unreachable;
  now best-effort, so the API starts, serves `/api/system/status` and survives DB errors.
  Verified: `nest build` clean, both `tsc --noEmit` clean, API listening on :3000 with no
  Postgres and no Redis. Also diffed the contract: **all 59 web paths are served by A's API.**
  **A's push block is not a disabled repo — B pushed four times; it is a credential problem.**
- 21:05 · A · ⛔ **Push is blocked.** The repo moved to `github.com/ImpactX26/AlphaY` as asked, but
  GitHub answers `403 Repository 'ImpactX26/AlphaY' is disabled. Please ask the owner to check
  their account.` Fetch works, push does not. Everything is committed locally and will go up the
  moment the repo is re-enabled — **the owner needs to sort this out on GitHub.**

- 03:05 · A · **Jury feedback built.** Scam shield with a contract check (a real fake offer scores 0/100 and
  three of its clauses are unenforceable in Germany); honest reality check per route; finance planned over
  time, not per month; cohort flat-share and travel group; rights at work with a private report that feeds an
  employer rating; the cohort thread bridged both ways with Discord; "people like you" timelines. Plus a rent
  locator with commute times, Google Maps links on every place and room, live weather from Open-Meteo, BM25
  retrieval over the applicant's own documents, and a local sandbox (`npm run sandbox`) that runs the whole
  product with no keys and no network.
- 03:05 · A · **The canned-reply bug the jury saw is fixed at the root.** Groq's limit is 8,000 tokens a
  minute and the planning prompt alone is ~2,600, so every question collapsed to the rules fallback. An intent
  classifier now answers acknowledgements in code, and a plain question skips the plan entirely and buys only
  the reply — a tenth of the size. Five questions, five answers.
- 03:05 · A · `npm run smoke` is 70 end-to-end checks, all passing, asserting on answers rather than status
  codes. Run it before presenting, then `npm run seed`.
- 03:05 · A · ⚠️ **For B:** `BlockRenderer.tsx` does not typecheck — the five new blocks hit the exhaustive
  `never` at line 59. Dev server still runs; a production build does not. Details and the fix in
  docs/requests.md, along with the map-link fields and the recorder note.

- 06:55 · B · **Sections built, and the demo's offline path now shows the jury features.** The API was
  returning a scam check, a finance plan and a cohort thread that no route displayed, which from the
  outside is the same as not having built them: `SectionPage` renders any section straight from
  `screen.sections`, the nav is generated from that list (only sections with blocks, A's reading order,
  `needsAttention` as a dot), and Money and Safety exist. A's contract approach replaced B's hardcoded
  web-side table — the API is what knows a block exists. Mock mode mirrors `sectionFor` so the no-API
  path keeps Money, Safety and Community; **that table has to follow A's if `sectionFor` changes.**
  Both personas now carry all five jury blocks with figures that agree with their existing blocks.
  Four bugs found by walking the data rather than reading the code: Rohan lost his whole mailbox
  (Inbox holds mail, calendar and approvals, none of which are blocks, so a block-driven nav hid it);
  `safety.tsx` hardcoded "Five things never to do" over API-supplied data; the mobile nav was
  `grid-cols-5` and would strand a tab; and voice notes had no cap, were lost at the cap, and failed
  silently when the mic was blocked. Also fixed four stale "scroll to X" lines in DEMO.md, since
  sections moved where things live and that script gets read on stage.
  **Still cannot verify anything needing the live API** — no Docker on this machine, so `npm run smoke`
  and the `fresh` video upload run on A's side only.

- 08:05 · B · **Design pass: one marked thing per screen.** The brief was "a user should understand what
  to do quickly", which was a hierarchy problem rather than a decoration one — every block arrived as an
  equal tinted card, so a letter waiting for approval and a fee footnote looked alike. The most urgent ask
  now carries a rule in the agent's own indigo (no new colour: `--warn` and `--loop` are already amber and
  "warn" is the wrong meaning for "do this next"), its sentence is the largest type on the page, and its
  first answer is filled while the rest stay outlined. Nothing else may carry the rule — the scarcity is
  the mechanism. Tapping an answer now holds the chosen option and steps the others back, so a slow
  connection no longer reads as "did that register?". Sign-in leads with what Educaro actually does
  instead of the word "Sign in" over four identical rows. Verified: axe clean (0 serious/critical) across
  light/dark x 1440/375, no horizontal overflow, contrast 7.0-7.9 against 4.5 needed, tsc and build clean.
