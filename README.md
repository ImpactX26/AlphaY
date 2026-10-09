# Educaro

**An agent that takes an Indian applicant from "I want to work in Germany" to a signed contract — and refuses to tell them anything it cannot prove.**

Built for ImpactX'26. Two personas, nine stages, eleven specialists, and a set of guards that are plain code rather than prompt instructions.

---

## The problem

About 1.8 million Indians apply to live and work in Germany every year. The process that decides whether they get to is spread across a dozen authorities, written in a language they are still learning, and administered by agents who are paid whether or not it works. The failure modes are well known and nobody automates them away:

- A certificate is rejected because the name on it carries a middle initial the passport does not.
- An employment contract contains eight clauses that German law voids, and the person signing it cannot read them.
- A university quietly drops its IELTS requirement from 6.5 to 6.0, and the four hundred people who were told "not yet" never find out.
- A "recruiter" asks for a placement fee by Western Union for a job that does not exist.
- Somebody arrives in Cologne in February having costed the visa and not the winter.

Educaro is an attempt to build the thing that catches all five.

---

## The one idea

**Every fact carries exactly one tag, and the tag decides what the product may do with it.**

| Tag | Means | Example |
|---|---|---|
| `verified` | A document proved it | CGPA 8.2, from the degree certificate |
| `said` | They told us, in a video or a CV | "I have A2 German" |
| `web` | A page was opened *in this run* and quoted verbatim | Blocked account is €11,904 |
| `ai` | The model generated it | A draft sentence in a letter |

A letter may only use `verified` and `said`. A web fact with no opened source and no quote is refused at the point of saving, not flagged afterwards. A document that fails its standard produces `said` facts, not `verified` ones — because a certificate from an issuer no German authority recognises has not proved anything.

This is why the product can be trusted to do the next part, which is act.

---

## What it does

### 1. Reads the papers and finds the contradictions

Upload a video and five documents. The agent transcribes, classifies, extracts, and builds a **truth map** — every claim beside its source, with conflicts surfaced rather than silently resolved.

For the seeded persona it finds all three planted conflicts: the CV says March 2021 and the employer's letter says 14 June 2021; the CV says "Ananya Nair" and the diploma says "ANANYA RAJAN NAIR"; the CV claims A2 German and no certificate exists anywhere in the set.

Grades, CEFR levels, Chancenkarte points and deadlines are computed in code and shown with their formula — `1 + 3 × (10 − 8.2) ÷ (10 − 4) = 1.9` — never asserted by a model.

### 2. Scam shield and fair-contract check

Paste anything you have been sent — an offer letter, a landlord's message, a recruiter's email — and it is checked before you reply to it.

- **Sender checks**: throwaway domains, free webmail against a claimed institution, untraceable payment routes, time pressure, fees before a contract, and the public registers that settle it (Hochschulkompass, anabin, Unternehmensregister).
- **Contract check**: 21 clause rules across employment and rental contracts, each citing the provision — unpaid overtime (BAG 5 AZR 517/09), passport retention, probation over six months, asymmetric notice (§ 622(6) BGB), holiday under the BUrlG minimum, repayment clauses, Vertragsstrafe, preclusion periods under three months, non-compete without Karenzentschädigung, pay-secrecy clauses, wage under MiLoG; and for rentals the three-month Kaution cap (§ 551 BGB), rigid Schönheitsreparaturen, blanket pet and sublet bans, lock-ins over four years, and "no viewing before you pay".

Rules are written once with umlauts and widened at load for the three spellings that actually reach us (`ü`, `ue`, `u`), and matched against the original text so the quote shown back is the applicant's own sentence.

> A seeded exploitative contract returns **13 flags, 8 of them not enforceable in Germany**. A fair TVöD-P contract returns none.

An illegal clause outranks a clean-looking sender: a real hospital sending a loaded contract cannot be headlined "looks legitimate".

### 3. Watched sources — the pages that decide who qualifies

Staff keep a list of university, government and employer pages. Each is re-read on its own schedule, parsed into comparable requirements, and diffed against the last reading.

Direction is computed from the applicant's point of view, which is a table rather than a comparison: a band dropping 6.5 → 6.0 is *easier*, a grade requirement dropping 2.5 → 2.0 is *harder*, and the two are identical as numbers.

Then it tells the people it moves for, by name:

- RWTH eases its entry requirements → **Karthik and Priya are told they now qualify**, with the specific thing that used to block them.
- The ministry drops the care-sector German threshold B2 → B1 → **Joseph becomes eligible**.
- Klinikum Köln raises its bar B1 → B2 → **the same Joseph is warned he no longer is**, in October rather than in March.

"You now qualify" is only ever said to somebody we can actually measure — an unknown IELTS band is not a failing one.

### 4. Document standards — *what is it verified against?*

A judge asked this, and the honest answer used to be "a model read it and we believed the fields". That is a summary, not a standard.

Eight written standards (passport, language certificate, experience letter, council registration, degree, diploma, transcript, APS), nine rule kinds, each naming the authority it comes from, all evaluated in code. A model may read a document and pull fields off it; it may not decide whether somebody's paperwork is acceptable.

The applicant sees the verdict on their own document with every reason, because "not accepted" with no reasons is exactly what a consulate already does to them.

`demo-documents/standards-check/` makes the point from both sides: the same claim about the same level of German, once on a Goethe certificate and once on a certificate from a private academy. Nothing on the rejected one is false — it is simply not issued by a body any Anerkennung office accepts, it is three years old, and the name carries a middle name the passport does not.

### 5. A CV written for one university, and the email that carries it

The most useful thing the product can do with documents it already holds, and the easiest place to start lying.

Tailoring is **selection and ordering, never addition**. The requirements come from the target's own page, opened in that run. The skills come from the applicant's own documents. A keyword the page wants and the applicant cannot evidence appears in the gap report and never on the CV.

Matching needs two patterns per term, because a prospectus asks for "programming experience" and an employment certificate says "backend services in Python and Java":

> Rohan matches **programming experience** and **distributed systems** — both verified from his Persistent Systems letter — and **English C1** via IELTS 7.0 on the Council of Europe alignment. Statistics, linear algebra and probability theory stay in the gap column: genuinely absent from his transcript, and genuinely required.

The letter carries the same guarantee the agent's other letters do — every sentence names the facts behind it and passes the source guard. Nothing sends: it creates an approval, because this one carries an attachment with their name on it to an address they will be judged by.

### 6. Honest reality check

Before anyone commits, the product says the hard parts out loud, with numbers. It is a strange thing for a company paid when people go, and it is the reason to trust the rest of the screen.

Personalised from their own figures rather than a page of identical prose:

> *"EUR 2,113 net a month against EUR 1,192 of living costs (EUR 715 of it rent). About EUR 921 left — before anything you send home."*
> *"You are at A2 and this route needs B2."*
> *"Your first winter in Cologne: about 1 °C on an average January night, dark by four from November. You have never lived through that in Kochi."*

Each of the five routes has its own content. Only money and a few hard truths are personalised — the shift pattern is the same for everyone on a ward, and inventing per-person variation in it would be dishonest.

### 7. Money, planned over time

Not "what does a month cost" but "how much do I need before I can go, and when".

- Live **ECB reference rates**, eight currencies, Indian digit grouping for rupees, labelled with the day they are from. (The constant this replaced was 17% out — about ₹2 lakh on the blocked account, in the one figure somebody carries into a bank.)
- Funding options that say what they cover, what they cost, when to start, who they are for, and the thing people most need and can least easily find out: **whether it removes the blocked account or merely pays for it**. Loans show the monthly repayment.
- The honest answer about German banks: they will not lend to somebody who has not arrived, has no Schufa file and no German payslip.

### 8. Cohort — flat-shares and travel groups

Arriving alone in a country whose language you do not have yet is the part that breaks people, and it is solvable with a list the product already holds. What was missing was the ability to say yes to somebody.

Real groups, with three rules: nobody is a member until they agreed; nobody's details leak before that; and "split evenly" comes back as a number per person per month.

**In Discord**, typed in the cohort channel as an ordinary sentence:

> *"I'd like to stay with Rohan and split the rent evenly"*

creates the group and sends Rohan a DM with **Yes / No thanks** buttons. The parse is rule-based and deliberately narrow — it ends in a message to a named third party about where they are going to live, so an unsure reading asks a question instead of acting. The same sentence works in the app's own cohort thread.

A joined flat-share then **moves the actual budget**: Ananya sharing with one other takes her room from €580 to €493, which moves the deposit and the first month.

### 9. Help button and rights at work

One tap when something is wrong at work. The confidentiality promise sits next to the send button, not in a footer, because the fear that stops a report is that the employer will hear about it.

Reports aggregate into an employer rating — and the rating **demotes that employer in matching**. Recommending somebody to an employer three people have reported for the same thing is the product failing at the exact point it promised to help. Below three reports there is no score, because one person's bad week is not a rating.

### 10. The cohort answers first

The community bot used to reply the instant a question was posted, which quietly killed the thing the thread exists for. Somebody who went through the Anerkennung in NRW last year knows things no source page contains, and they will not type it underneath a confident answer that is already there.

So it waits. If a person answers, it stays out entirely. If nobody has, it **searches, opens what it finds, and answers from the pages** with the links underneath.

### 11. Life in Germany, on a map

Eight categories drawn from OpenStreetMap around their actual address, filterable: Indian and Asian groceries, Indian restaurants, temples and gurdwaras, the Bürgeramt, stations, pharmacies, police stations, and hostels for the first night.

> Go Asia 203 m · Rangoli 466 m · Köln Hauptbahnhof 619 m · Polizeipräsidium Köln 3.8 km

Police stations and hostels are drawn by default rather than on request: knowing where the police station is costs nothing and matters a great deal on one particular evening.

### 12. German that explains itself

The product keeps the German word for a German thing on purpose — the letter from the Ausländerbehörde says *Ausländerbehörde*, and a service that has only ever said "foreigners authority" has not prepared anybody for the envelope.

41 terms carry their meaning inline: a dotted underline, the short meaning on hover, the full explanation on tap. Spellings are folded, because these words reach us typed with umlauts, transliterated and stripped.

---

## The guards

Plain code, not prompt instructions. Each one refuses at the point of action.

| Guard | What it refuses |
|---|---|
| **No source, no save** | A `web` fact whose page was not opened in this run, or whose quote is not on it |
| **No personal data in web searches** | A search query carrying a name, passport number or address |
| **Required checks cannot be skipped** | A route decision before the specialists that gate it have run |
| **Letters use only Verified and You-said facts** | A sentence citing a fact that is `ai` or does not exist |
| **Nothing leaves without a human tap** | Any outbound mail, application or calendar invite without an approval |
| **At most two open questions** | A third question while two are already waiting |

---

## Architecture

```
upload / chat / email reply / Discord message / timer
        │
        ▼
   BullMQ job ──► agent loop ──► supervisor (LLM plans, rules fall back)
                                      │
                      ┌───────────────┼────────────────┐
                      ▼               ▼                ▼
                 specialists      guards (code)    MCP tools
                 (parallel)                      (own MCP server)
                      │
                      ▼
              screen composer ──► typed blocks ──► React
```

**Code fills the block data; the agent picks the order and writes the words.** The screen is a typed list of 26 block types in `packages/shared/src/screen.ts`, so a new block needs no change in the router.

Eleven specialists run in parallel as queue jobs: `route`, `exams`, `scout`, `money`, `life`, `recognition`, `visa`, `housing`, `jobs`, `safety`, `factcheck`, plus the writer and interview coach.

### Stack

| Layer | Choice |
|---|---|
| API | NestJS, TypeScript |
| Web | React 19 + Vite + Tailwind, React Query, React Router |
| DB | Postgres 16 with pgvector (Drizzle ORM) |
| Queue | BullMQ on Redis |
| LLM | Groq `openai/gpt-oss-120b` (free tier) → OpenAI under a hard spend cap |
| Speech | Groq `whisper-large-v3-turbo`, local `faster-whisper` fallback |
| Mail | Nodemailer SMTP + IMAP, Mailpit as the tracker |
| Maps | OpenStreetMap / Overpass, Leaflet |
| Rates | ECB via frankfurter.app |
| Chat | discord.js |
| Tools | Own MCP server — the harness talks to its own tools over MCP |

### Cost discipline

Roughly $48 of OpenAI budget for the whole build, so:

- Every model call goes through one gateway, cached by prompt hash, under a hard spend cap.
- **Prefer code over a model call.** Grades, CEFR, Chancenkarte points, readiness, deadlines, matching filters, contract rules, document standards and truth-map comparison are all computed.
- Every LLM-backed feature has a rule-based fallback, so **the whole product runs with zero API keys**.
- An intent classifier answers acknowledgements in code and routes a plain question to a small focused prompt rather than the whole planning apparatus.

---

## Run it

```bash
docker compose up -d          # Postgres :5433, Redis :6379, Mailpit :1025 / UI :8025
npm install
npm run build:shared
cp .env.example apps/api/.env # everything runs without keys
npm run db:push
npm run dev:api               # http://localhost:3000/api
npm run dev:web               # http://localhost:5173
npm run seed                  # the two personas, with generated demo papers
```

**Demo logins** — one tap on the sign-in page, or `POST /api/auth/demo { persona }`:

| Persona | Who |
|---|---|
| `ananya` | GNM nurse from Kochi. Sister in Cologne. Experience-date conflict, name mismatch, claims A2 without proof. |
| `rohan` | B.Tech CS from Pune, CGPA 8.2 (German 1.9). IELTS 7.0 claimed with no report, APS not started. |
| `staff` | The command centre. |
| `fresh` | An empty account, to run the whole pipeline live. |

Other useful commands:

```bash
npm run smoke        # 87 end-to-end checks, asserting on answers rather than status codes
npm run demo:docs    # regenerate the demo PDFs into demo-documents/
npm run sandbox      # the whole product with no keys and no network
```

Outgoing mail lands in **Mailpit** at http://localhost:8025. Safe mode redirects any address that is not in `MAIL_ALLOWED` to the team inbox, keeping the intended recipient in the subject and the tracker — so a prototype never mails a real admissions office by accident.

---

## Repo map

```
apps/api/src/
  agent/         loop, supervisor, guards, specialists, composer, intent
  knowledge/     code-only truth: grades, CEFR, contracts, standards,
                 requirements, keywords, funding, places, reality, money
  ingest/        classify → extract → facts
  profile/       facts, truth map, questions, chat, retrieval
  outbound/      writer, tailor, pack (PDF/DOCX), mail, approvals, calendar
  watch/         the watched-source poller and diff
  standards/     document standards and their verdicts
  community/     cohort thread, flat-share groups, share-intent parsing
  safety/        scam checks and private employer reports
  mcp/           our own MCP server and client
  mockweb/       stand-in institution pages, including ones that change
apps/web/src/
  applicant/     the nine-stage applicant app
  staff/         pipeline, queue, copilot, matching, sources, standards, employers
  screen/        block renderer — 26 typed blocks
packages/shared/ the contract: domain types, screen blocks, REST DTOs, glossary
demo-documents/  real PDFs carrying the planted conflicts
```

---

## What is honest about this build

It is a 20-hour prototype and the README should say where the edges are.

- **Mock institution pages.** The demo opens stand-ins served at `/api/mock/...` rather than live university sites, so a flaky conference network cannot decide whether the product works. The wording is ours; the numbers match the real pages as checked in `research/`. Point any catalogue entry back at the real URL and the same code path runs unchanged.
- **The alumni figures** come from exit conversations (n≈120) and are labelled as that, not as a study.
- **The watcher's demo sources** carry two versions each so a change can be seen happening on stage. Real pages change when the institution changes them.
- **English only.** German terms are glossed inline rather than the interface being translated — an applicant who has not arrived does not want a German UI.
- **Nothing is sent to a real third party** unless its address is explicitly allowlisted.

---

## Credits

Built for ImpactX'26 by two Claude agents working in parallel on one repo — one on the API, agent harness and knowledge layer, one on the web app and the HTTP layer — with a human holding the product line.

The spec that started it is `educaro_applicant_flow_v2.html`. The build log, including what broke and why, is `PROGRESS.md`.
