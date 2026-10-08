# Tech

Written for: the engineers who pick this up after the hackathon.

What we built, what we chose, and where we went against the original plan. [docs/architecture.md](docs/architecture.md)
has the diagrams; this is the reasoning.

---

## The stack, as built

| Layer | Choice | Why this one |
|---|---|---|
| Web | React 19, TypeScript, Vite | One app serves `/app` and `/staff`; the contract is imported as source, so a type error in the API shows up in the browser build |
| API | NestJS 11 | Constructor injection kept forty-odd services wireable by one person under time pressure |
| Contract | `packages/shared` | Domain types, the 18 screen blocks, REST DTOs and socket messages in one place, imported by both sides |
| Queue | BullMQ on Redis | Every event is a job. Needed delayed jobs, repeatable jobs and a per-key lock, and got all three |
| DB | Postgres 17 + pgvector | Facts, files, traces, sources, page cache, LLM cache |
| ORM | Drizzle | `drizzle-kit push` against a live schema beat writing migrations for a 20-hour build |
| Realtime | socket.io | One event name, `msg`, carrying a typed `ServerMessage`; rooms per applicant and one for staff |
| Models | Groq `gpt-oss-120b` free, OpenAI `gpt-5-mini` capped | See **Cost** below |
| Transcription | Groq `whisper-large-v3-turbo`, local `faster-whisper` fallback | Free, fast, and good enough on Indian-accented English |
| Documents in | unpdf, tesseract.js, mammoth | Text PDFs, scans, DOCX |
| Documents out | pdfkit, docx | Lebenslauf and the final pack, both formats |
| Mail | nodemailer + imapflow + mailparser | Real Gmail with an app password; replies read over IMAP |
| Mail tracker | Mailpit | Every outgoing mail mirrored, and the staff page embeds its UI |
| Chat | discord.js | Slash commands and DMs against the same agent |
| Tools | `@modelcontextprotocol/sdk` | Our own MCP server at `/api/mcp` |
| Scraping | cheerio, Tavily, DuckDuckGo | See **Reading the web** below |

---

## Where we went against the plan

The original tech.md was a list of libraries chosen before anything existed. Most of it survived.
These did not, and the reasons are worth keeping.

**The agent loop is ours, not a framework's.** The plan was the Vercel AI SDK, partly for its
`needsApproval` step. We wrote the loop by hand instead. The whole product is the guards — six rules
about what may be saved and what may be sent — and they had to be plain functions we could read in
one sitting and point at during a demo. A framework's approval hook would have covered one of the
six. The loop is about 200 lines; the guards are about 120. Both are easier to defend than to
configure.

**MCP by hand, not `@rekog/mcp-nest`.** A decorator per method reads nicely, but we wanted the tool
list to be data — a single array a reviewer can read — and we wanted the guards attached to the
tools rather than to the caller, so an MCP client cannot get a looser agent than our own loop has.
Eleven tools, one file.

**No docling-serve.** A Docker service for OCR is the right call for a product and the wrong one for
a laptop demo on hotel wifi. unpdf handles text PDFs, tesseract.js handles scans, and the seeded
demo papers are generated as real PDFs so the pipeline does real work either way.

**Tavily and DuckDuckGo, not SearXNG.** Another container we would have to keep alive. Tavily is
clean and ranked but costs credits and rate-limits; scraping DuckDuckGo's HTML is free but breaks
whenever they touch their markup. Neither is reliable enough alone, so both run and the trace
records which answered.

**Our own extractor, not Readability.** Explained below — the "no source, no save" guard raises the
bar past what a generic readability pass clears.

**Interview coach is text, not the browser speech API.** Voice went into the chat box instead, where
it matters more: speaking a question is how someone actually uses this on a phone.

---

## Cost

The budget was about $48 of OpenAI for the whole prototype, so cost is the shape of the system, not
a quota bolted on.

**Code first.** Grades, CEFR arithmetic, Chancenkarte points, readiness meters, deadlines, matching
filters, money and budgets, and the whole truth-map comparison are computed. The model never does
arithmetic we can do ourselves, and it never decides whether two dates disagree.

**Two tiers.** Groq's free `gpt-oss-120b` handles classification, reading a document, reading a
transcript, composing the screen, extracting requirements, interview turns and broadcast lines.
OpenAI handles supervisor plans and letters, under a hard spend cap read from the trace table at
boot — if the cap is hit, the cheap tier takes over.

**Everything cached by prompt hash.** A rehearsal costs nothing the second time.

**Every model-backed feature has a rule-based fallback.** This was not a nice-to-have: the entire
flow was built and tested with no keys at all, including both personas end to end. It also means a
rate limit degrades the writing, never the product.

**No retry loops.** The SDK's two retries were turned off deliberately — a retry re-spends tokens,
and every task already has a fallback.

---

## Reading the web

A Web fact may only be saved when the quote is verbatim on a page opened in that same run. That one
rule decides how the scraper is built, because anything the extractor drops can never be cited.

Two things a generic text dump gets wrong:

**Tables.** Requirements live in them. `IELTS | 6.5 overall` stripped to two cells is two unrelated
fragments, and the sentence worth quoting never exists. Rows and definition lists are flattened to
`label: value`.

**Navigation.** A university menu is a hundred short links and it drowns the eight sentences that
matter. The densest container wins, scored by text length with link text discounted, so a menu
scores badly however long it is.

For the demo itself, the handful of pages the agent opens are served from `/api/mock/<slug>` — real
HTTP, real fetch, real quote-checking, but not dependent on hotel wifi or on a university editing
its page overnight. Point a catalogue entry at the live URL and the identical code path runs; that
is the test of whether the stand-ins are honest.

---

## Things that broke, and what they changed

Worth reading before trusting any of this in production.

**`ffmpeg-static` installed a binary for the wrong platform.** Every audio and video upload died
with "not a valid application for this OS platform". Whisper's API already accepts the containers a
browser records into, so ffmpeg came off the critical path entirely — it is now only reached for a
container the API will not take.

**An unanchored `GPA` matched inside `SGPA`.** A transcript lists every semester before the
cumulative figure, so the final grade read as first-semester 7.6 instead of 8.2 — wrong in the one
place that most needed to be right, since every German university compares against the converted
number. The German equivalent is now computed onto the grade fact itself, not written into a
sentence the agent could overwrite.

**A mock-mode pin in `localStorage` outlived the session.** One tap on the sign-in page pinned a
browser to the mock layer permanently, with a healthy API running. Nothing looked broken — the chat
answered with canned text, uploads appeared to work — which made it the most expensive bug of the
build. Session-scoped now, with the legacy pin cleared on read.

**A slow model call froze an applicant's agent.** The loop holds a per-applicant lock for the length
of a run, and the SDK's default is a ten minute timeout with two retries. One slow call held that
lock for half an hour while events piled up behind it, with nothing in the log. Model calls now time
out at 45 seconds, and the whole run has a 150 second ceiling: no single dependency may end
someone's agent.

**Approving a university application did nothing.** A letter to an employer is emailed; a university
is applied to through a portal, and only the email path had a send. The applicant tapped approve,
the status changed, and nothing happened — in the one moment the product asks for their trust. It
now mails them the finished pack with the portal link.

The pattern across all five: the system kept working, and quietly produced a worse answer. That is
what the guards and the trace are for, and it is why every feature here was opened and run rather
than assumed.

---

## Running it

```bash
docker compose up -d        # Postgres :5433, Redis :6379, Mailpit :8025
npm install
npm run build:shared
cp .env.example apps/api/.env
npm run db:push
npm run seed                # personas, generated papers, programmes, openings
npm run dev:api             # :3000/api
npm run dev:web             # :5173
```

Everything runs with no keys. Fill `GROQ_API_KEY` for real transcription and better writing,
`SMTP_USER`/`SMTP_PASS` for real mail, `DISCORD_TOKEN` for the bot, `OPENAI_API_KEY` for the quality
tier. `npm run demo:docs` writes the demo papers to `demo-documents/` for uploading by hand.

---

## What is not finished

- **pgvector is wired, retrieval is not used.** The `doc_chunks` table and the embedding column
  exist; nothing reads from them yet. The honest reason is that the truth map and the requirement
  matrix answered every question we had without it.
- **The MCP server is a real server, but our own harness still calls the tools in-process.** The
  seam exists and is tested; we have not moved our own loop onto it.
- **Safe mode is on.** A prototype must never mail a real hospital, so third-party recipients are
  redirected to the team mailbox and the tracker shows a badge. Turning it off is one environment
  variable and should stay a deliberate act.
- **Link capability.** `/api/applicants/:id/book-call` and the call room are open by link, with the
  applicant's id as the capability, because they are followed from email and calendar invites where
  no header is attached. A real deployment wants a signed single-use link.
