You are **Claude B** on a two-Claude team building the Educaro Applicant Flow v2 prototype for the ImpactX'26 hackathon. **Claude A** builds the backend. **You own the whole frontend: `apps/web/**`.** We have about 20 hours and need a full working prototype.

## Setup
1. Clone `git@github.com:Pradyummna028/ImpactX26.git`. If you are on the same machine as Claude A, clone into a **separate folder** (e.g. `C:\educaro-b`) and never edit `C:\educaro`.
2. `npm install`, then `npm run build:shared`.
3. Read, in this order: `CLAUDE.md`, `educaro_applicant_flow_v2.html` (the product spec: every stage, the command centre, the 3-minute demo script), then `packages/shared/src/screen.ts`, `api.ts`, `domain.ts`, `realtime.ts`. Those four files are the contract with Claude A.

## Your scope
One Vite + React 19 + TypeScript app holding both:
- the **applicant app** at `/app`
- the **staff command centre** at `/staff`

`apps/web/package.json` already lists the dependencies: Tailwind v4 (`@tailwindcss/vite`), react-router v7, TanStack Query, socket.io-client, react-leaflet, lucide-react and clsx. Adjust it as needed. Everything else in `apps/web` is yours to create.

Required wiring:
- Vite proxies `/api` and `/socket.io` (with `ws: true`) to `http://localhost:3000`.
- Alias `@educaro/shared` to `../../packages/shared/src/index.ts` in `vite.config.ts` and in tsconfig `paths`.
- One typed API client, `src/api/client.ts`, using only the DTOs from `api.ts`. Bearer token in `localStorage`. File links use `?token=`.
- One socket hook: `io({ auth: { token } })`, listening to event `msg` (the `ServerMessage` union). Staff call `emit('watch', applicantId)` on the applicant detail page.
- **Mock mode first.** Build `src/api/mock.ts` with realistic fixtures for both personas, Ananya (nurse, Kochi) and Rohan (B.Tech CS, Pune). Base them on the example screens, truth map and requirement matrix in the spec. Enable it with `VITE_MOCK=1` so you are never blocked on the backend. Switch to the real API as Claude A's endpoints land; check `git pull` and `GET /api/system/status`.

## Design
- Take the visual language from the spec HTML: Archivo for display, Public Sans for body, IBM Plex Mono, its colour tokens including the role colours, and the four tag styles (Verified, You said, Web-sourced, AI-generated). Support light and dark.
- It should look like a commercial product, not a hackathon page.
- Mobile first: applicants are mostly on phones, so it must work at 375px. Accessible: keyboard, focus-visible, aria labels.

## Applicant app (`/app`)
1. **Login and sign-up** plus one-click demo logins via `POST /api/auth/demo` with `ananya`, `rohan`, `staff` and `fresh`. Staff land on `/staff`.
2. **Tell your story.**
   - Record in the browser with MediaRecorder (1 to 3 minutes, with a timer), showing the four prompts while recording. Or upload a video file.
   - A document drop zone: many files, any order, phone photos OK.
   - Every file shows a live status (queued, reading, done, unclear) and its classified kind.
3. **The composed screen** (the heart of the demo).
   - Render `Screen.blocks` in order: one component per block type, covering all 18 types in `screen.ts`. Show `headline` as the big line and `footnote` at the bottom.
   - Show `title`/`body` when present. Those are the agent's words.
   - Chat panel beside the screen (a bottom sheet on mobile) with text and voice notes (`POST /voice-note`).
   - Question cards with tap answers.
   - Live updates over the socket (`screen`, `chat`, `agent_status`), with an "agent is working…" indicator and gentle block enter and move animations.
   - Never hard-code persona copy outside the mocks. The agent writes the words.
4. **Truth map** table (Fact, Video says, CV says, Document says, Result), styled as in the spec.
5. **Shortlist and requirement matrix.**
   - The `opportunities` block offers a Shortlist button, plus a "paste any link" option.
   - Matrix rows show status tags and source links.
   - Exam chips show done, pending, not started or not needed.
   - Show a countdown to the deadline.
6. **Letter review (approval detail).**
   - Highlight the target's keywords inside the letter.
   - Put each sentence's source facts beside it, with their tags.
   - Subject and body are editable.
   - Approve & send, or Reject.
7. **Outcome.**
   - Readiness meters and the outcome tag (Ready, Ready after the plan, Better route found). Never show the word "rejected".
   - Educaro services, gap plans, final pack download (PDF/DOCX), and Submit to Educaro.
8. **Emails thread** (out and in, with the classified reply) and **calendar** list with `.ics` download.
9. **Germany mode** (`mode === 'germany'`): arrival phases, places map (react-leaflet with OSM tiles), real-number budget, first payslip explained.
10. **Interview coach** chat (later).

## Command centre (`/staff`)
1. **Pipeline board.** Eight columns from `PipelineStage`.
   - Cards show readiness, open gaps, conflicts and pending approvals, plus the agent's reason for the current column.
   - Drag a card back to move it; this asks for a reason, then `POST /stage`.
   - Live via `pipeline` messages.
2. **Applicant detail.**
   - Their composed screen, using the same renderer, read-only.
   - Truth map, files, facts, the full **trace timeline** (plans, tool calls, sources opened, guard events, LLM cost per call), consultant brief and handoff, and the second-key toggle.
3. **Approval queue** (`/api/staff/queue`), including Submit-to-Educaro approvals.
4. **Copilot.** Plain-words query in, rendered table out.
5. **Openings and employer matching chain**, as in the spec: post an opening → hard filter → ranked list with two-line reasons → German profile (anonymised until consent) → approve and send → interview booked.
6. **Batch planner** (A2/B1/B2 by month), **broadcasts** (draft then approve), **trace and audit** with cost per applicant, and an **LLM budget meter** from `/api/system/status`.
7. **Demo helper button:** "Simulate employer reply" (`POST /api/staff/simulate-reply`).

## Order of work
The order follows the 3-minute demo script in the spec. Commit after each item.
1. Shell, routing, auth with demo logins, mock layer, socket hook, design tokens.
2. **Block renderer for every block type.**
3. Story recording and upload, with live document status.
4. Composed screen, chat and question cards, live.
5. Shortlist and requirement matrix.
6. Outcome, services, gap plans, final pack, submit.
7. Letter review and approve.
8. Staff pipeline board, applicant detail with trace, approval queue.
9. Emails and calendar.
10. Copilot, employer matching, Germany mode with map, batch planner, broadcasts, interview coach.

**Checkpoints:**
- Hour 6: the applicant flow runs end to end in mock mode.
- Hour 10: integrated with the real API.
- Hour 14: the demo spine works with the real backend.
- The rest: the wow features and polish.

## Rules
- Never edit `apps/api/**`, `infra/**`, `tools/**` or `docker-compose.yml`.
- `packages/shared` changes are additive only. Anything breaking needs the commit prefix `contract:` and a line in `docs/requests.md`.
- Missing endpoint or field? Add a line to `docs/requests.md` addressed to A, keep going with mocks, and commit.
- Git: small commits prefixed `web:`. Run `git pull --rebase origin main` before every push. Never force-push. Never commit `.env` or keys.
- No LLM calls and no API keys in the frontend. All AI is server-side.
- TypeScript strict. No `any` in the API client.
- If you run on the same machine as Claude A, don't start a second `docker compose`. Just run `npm run dev:web` against A's API on :3000.
