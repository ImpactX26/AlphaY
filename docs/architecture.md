# Architecture

Written for: engineers and judges reading this cold, in about five minutes.

One sentence: **every event becomes a queue job, a supervisor plans the next moves, specialists run
in parallel, guards written in plain code decide what may be saved or sent, and the screen is a list
of typed blocks that code fills and the agent orders.**

---

## The whole system

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                                     │
│                                                                              │
│   /app  applicant          /staff  command centre                            │
│   React 19 + TypeScript · Vite · one app, two shells                         │
└───────────────┬──────────────────────────────────┬───────────────────────────┘
                │ REST  /api/*                     │ WebSocket  socket.io
                │ (Bearer token)                   │ event "msg"
                ▼                                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  NestJS API                                                                  │
│                                                                              │
│   HTTP          applicant · staff · auth · system · mock-web · call          │
│   Realtime      rooms: applicant:<id> and staff                              │
│   MCP server    /api/mcp — 11 tools, guards attached                         │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │ every event becomes a job
                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  BullMQ on Redis       ingest · agent · specialists · outbound · timers      │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  THE AGENT LOOP                          (one run per applicant, locked)     │
│                                                                              │
│    read state → supervisor plans → ask · specialists · act → compose → move  │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │
     ┌──────────┼───────────────────────────────┬──────────────────────┐
     ▼          ▼                               ▼                      ▼
┌──────────┐ ┌──────────┐              ┌─────────────────┐   ┌──────────────────┐
│ Postgres │ │  Groq    │              │  Outside world  │   │  Files on disk   │
│ pgvector │ │  OpenAI  │              │  SMTP · IMAP    │   │  uploads, PDFs   │
│ :5433    │ │          │              │  Discord · web  │   │  generated packs │
└──────────┘ └──────────┘              └─────────────────┘   └──────────────────┘
```

---

## One event, end to end

This is the path every single thing takes — an upload, a chat message, an answer, an email reply, a
Discord message, a timer. There is no second path.

```
  upload · chat · answer · email reply · discord · timer
                      │
                      ▼
      ┌───────────────────────────────┐
      │  buffer the event in Redis    │   debounced, so five files dropped
      │  per applicant, then wake     │   together are one run, not five
      └───────────────┬───────────────┘
                      ▼
      ┌───────────────────────────────┐
      │  take the per-applicant lock  │   two runs for one person never overlap
      └───────────────┬───────────────┘
                      ▼
      ┌───────────────────────────────┐
      │  READ STATE                   │   files · facts · truth map · questions
      │                               │   shortlist · gaps · approvals · calendar
      └───────────────┬───────────────┘
                      ▼
      ┌───────────────────────────────┐
      │  SUPERVISOR  (one LLM call)   │   plans: route, what to ask, which
      │  rule fallback if no key      │   specialists, what to do outside, reply
      └───────────────┬───────────────┘
                      ▼
      ┌───────────────────────────────┐
      │  REQUIRED CHECKS GUARD        │   a plan may not skip a required check
      └───────────────┬───────────────┘
                      ▼
      ┌───────────────────────────────┐
      │  SPECIALISTS, in parallel     │   each one a queue job
      └───────────────┬───────────────┘
                      ▼
      ┌───────────────────────────────┐
      │  ACT OUTSIDE                  │   draft a letter · book a call · notify
      │  nothing sends without a tap  │   → creates an approval, never sends
      └───────────────┬───────────────┘
                      ▼
      ┌───────────────────────────────┐
      │  CHECKS → GAPS → PLANS        │   computed in code, routed to a service
      └───────────────┬───────────────┘
                      ▼
      ┌───────────────────────────────┐
      │  COMPOSE THE SCREEN           │   code fills block data
      │                               │   the agent picks order and writes words
      └───────────────┬───────────────┘
                      ▼
      ┌───────────────────────────────┐
      │  MOVE THE PIPELINE CARD       │   forward only, with a reason
      └───────────────┬───────────────┘
                      ▼
            push over the socket → the screen changes while they watch
```

---

## The twelve specialists

They do not talk to each other. Each reads state, does its own work, writes its output, and the
composer reads all of them. That is why they can run at once.

```
  route        which route fits, and why not the others
  exams        which language exam, where, what it costs
  recognition  Anerkennung: what is sent, how long, what comes back
  visa         which visa, which papers, which deadlines
  scout        find programmes that match the grade and the subject
  jobs         find openings that match the qualification
  money        blocked account, net pay, what a month costs
  housing      what rent looks like, which districts
  life         what is near: clinics, schools, shops, community
  writer       the letter — only from Verified and You-said facts
  interview    mock visa, employer and university interviews, scored
  factcheck    re-open every page we quoted; has it changed?
```

---

## Facts, and why a tag is not decoration

Everything the agent knows is a fact with exactly one tag. The tag decides what the fact is allowed
to do, and the rules are enforced in code, not asked of the model.

```
  verified   a document proves it          → may be used in a letter
  said       they said it (video or CV)    → may be used in a letter, marked as claimed
  web        a page we opened says it      → needs url + verbatim quote, checked
  ai         the agent worked it out       → may never be used as proof
```

The truth map is just this, read sideways: the same claim from the video, the CV and a document,
side by side. Where they disagree, that is a conflict, and a conflict becomes a question.

```
                video        CV            document        → status
  Name          —            Ananya Nair   ANANYA RAJAN…   → conflict
  Experience    "4 years"    Mar 2021      Jun 2021        → conflict
  German        "about A2"   A2            —               → no proof
  Diploma       "GNM 2021"   GNM           GNM certificate → verified
```

---

## The six guards

Plain functions. The model cannot argue with them, and an MCP client cannot get around them,
because they sit with the tools rather than with the caller.

```
  1  no source, no save      a web fact needs a page opened in this run,
                             and the quote must be on it
  2  required checks run     a plan may not skip a check the route requires
  3  letters cite facts      only Verified and You-said may appear in a letter
  4  a human taps            nothing leaves without an approval
  5  at most two questions   and never one a document already answers
  6  no personal data        a name or passport number never reaches a search
```

---

## Cost

The budget is about $48 of OpenAI for the whole prototype, so the shape of the system is the cost
control, not a quota.

```
  computed in code, never by a model
      grades · CEFR maths · Chancenkarte points · readiness · deadlines
      matching filters · the truth-map comparison · money and budgets

  cheap tier     Groq openai/gpt-oss-120b (free)
      classify · read a document · read a transcript · compose the screen
      requirement extraction · interview turns · broadcast lines

  quality tier   OpenAI, under a hard spend cap
      supervisor plans · letters

  every response cached by prompt hash, so a rehearsal is free the second time
  every model-backed feature has a rule-based fallback, so it runs with no keys
```

---

## What runs where

```
  apps/web          React 19, Vite, one app for /app and /staff
  apps/api          NestJS 11 — loop, specialists, guards, ingest, mail, MCP
  packages/shared   the contract: domain types, screen blocks, DTOs, socket messages

  Postgres 17 + pgvector   :5433   facts, files, traces, sources, page cache
  Redis                    :6379   queues, event buffers, locks, link codes
  Mailpit                  :8025   every outgoing mail, mirrored — the tracker
```

Reading order, if you want the code: `agent/loop.service.ts` first, then `agent/guards.service.ts`,
then `profile/truth-map.ts`, then `agent/composer.service.ts`. Those four are the product.
