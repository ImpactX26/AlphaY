# Educaro Applicant Flow v2 — ImpactX'26 prototype

Read `educaro_applicant_flow_v2.html` first. It is the product spec: nine applicant stages, the agent loop,
twelve specialists, the staff command centre, the architecture and the 3-minute demo script.

**Deadline:** a full working prototype in 20 hours (build started 2026-10-08). The spine must work end to
end first (see "The 24-hour cut" in the spec), then the wow features in order.

**Scope decisions:**
- English only. No Hindi, Malayalam or Tamil in this build.
- "v1" in the spec means Educaro's live website (educaro.de), not a codebase. Everything here is new.
- The stack in the spec is required.

## Two builders, split by folder

| Owner | Folders | Builds |
|---|---|---|
| **Claude A** | `apps/api/**`, `infra/**`, `tools/**`, `docker-compose.yml`, seed data | NestJS API, agent harness, specialists, guards, MCP server, queues, ingest (OCR, Whisper), mail, calendar, Discord bot, PDF/DOCX, seed personas |
| **Claude B** | `apps/web/**` | React + TS: the applicant app (`/app`) and the staff command centre (`/staff`) in one Vite app |
| Shared | `packages/shared/**` | The contract: domain types, screen blocks, REST DTOs (`api.ts`), socket messages |

- Never edit the other side's folders. If something there blocks you, write it down in `docs/requests.md`
  (who, what, why) and commit that file.
- `packages/shared`: additive changes only (new optional fields, new types). A breaking change needs the
  commit prefix `contract:` and an entry in `docs/requests.md`.

## Git workflow (repo: github.com/Pradyummna028/ImpactX26, branch `main`)

- Small commits, often. `git pull --rebase origin main` before every push. Never force-push.
- Commit message prefixes: `api:`, `web:`, `shared:`, `contract:`, `infra:`, `docs:`.
- Never commit `.env`, keys, `storage/` or `node_modules`.

## Run it

```bash
docker compose up -d            # pgvector Postgres :5433, Redis :6379, Mailpit SMTP :1025 / UI :8025
npm install
npm run build:shared            # or: npm run dev:shared (watch)
cp .env.example apps/api/.env   # fill keys if you have them; everything runs without keys
npm run db:push                 # drizzle schema -> Postgres
npm run dev:api                 # http://localhost:3000/api
npm run dev:web                 # http://localhost:5173 (proxies /api and /socket.io to :3000)
```

- Local Whisper fallback: `python -m venv tools/whisper/.venv` then `tools/whisper/.venv/Scripts/pip install faster-whisper`.
- Demo inbox (every outgoing mail lands here): http://localhost:8025

## Architecture in one paragraph

Every applicant event (upload, chat, answer, email reply, Discord message, timer) becomes a BullMQ job. The
**agent loop** reads state, the **supervisor** (LLM) plans moves (ask, read documents, run specialists, rewrite
screen, act outside). Specialists run in parallel as queue jobs. **Guards are plain code**: no source no save,
required checks cannot be skipped, letters use only Verified and You-said facts, nothing leaves without a
human tap, max two open questions, no personal data in web searches. Tools are served by our own **MCP server**
(the harness talks to it over MCP). The **screen** is a typed list of blocks (`packages/shared/src/screen.ts`).
Code fills block data and the agent picks the order and writes the words. React renders it.

## LLM cost rules (budget: about $48 of OpenAI in total)

- All model calls go through `apps/api/src/llm/llm.service.ts`. Never construct an OpenAI client elsewhere.
- `cheap` tier → Groq `openai/gpt-oss-120b` (free). `quality` tier → OpenAI (`OPENAI_MODEL`) under a hard
  spend cap (`OPENAI_BUDGET_USD`). Every response is cached by prompt hash, so replays are free.
- Prefer code over a model call. Grades, CEFR, Chancenkarte points, readiness, deadlines, matching filters
  and truth-map comparison are computed in code, never by the model.
- Every LLM-backed feature needs a rule-based fallback, so the app runs with zero keys.
- No retry loops that re-spend tokens. Supervisor runs are capped per event.
- Transcription: Groq `whisper-large-v3-turbo` (free), with local `faster-whisper` as the fallback.

## Field tags (every fact carries exactly one)

`verified` (only a document can verify) · `said` (video or CV) · `web` (needs a link opened in this run, with
a verbatim quote) · `ai` (generated).

## Personas for the demo (seeded)

- **Ananya Nair**, GNM nurse from Kochi. Sister in Cologne. Experience-date conflict, name mismatch on her
  diploma, claims A2 German without proof. Route: nursing with Anerkennung.
- **Rohan Mehta**, B.Tech CS from Pune, CGPA 8.2 (German grade 1.9). IELTS 7.0 claimed without a report,
  APS not started. Route: Master's. Shortlist: RWTH Aachen MSc Data Science, TUM Informatics, TU Darmstadt
  Autonomous Systems.
- Demo logins: `POST /api/auth/demo { persona: 'ananya' | 'rohan' | 'staff' | 'fresh' }`.
