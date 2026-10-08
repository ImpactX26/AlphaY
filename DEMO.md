# Demo walkthrough — Educaro Applicant Flow v2

Everything below is live: real Postgres, real Redis, a real Groq model, a real Gmail mailbox and a
real Discord server. Nothing on this page is a mock.

## Start it (about 40 seconds)

```bash
docker compose up -d                 # Postgres :5433, Redis :6379, Mailpit :8025
npm run build:shared
npm run db:push                      # only the first time
npm run seed                         # personas, their papers, programmes, employer openings
npm run dev:api                      # http://localhost:3000/api
npm run dev:web                      # http://localhost:5173
```

Open **http://localhost:5173?mock=0** — the `?mock=0` pins the app to the live API. Keep two more
tabs ready: **http://localhost:8025** (the mail tracker) and your Discord server.

Check the footer on the sign-in page: it should read `groq ✓` and `discord ✓`.

---

## The 3 minutes

### 1 · "She uploads her life, not a form" (40 s)

Sign in as **Ananya**. One click, no password.

Her screen is already built. Point out that **nobody typed any of this**: the seed generated her
GNM diploma, her experience letter, her nursing council registration, her Class 12 marksheet and
her CV as real PDFs, and the agent read them — text extraction, sorting, claim reading — the same
way it reads anything a real applicant drops in.

Scroll to **Your documents**: five papers, each sorted by type with a confidence score.

> If you want to show the live path instead, sign in as **fresh** and drop any PDF or record a
> clip. It runs through the same pipeline, Whisper included.

### 2 · "It finds what she did not tell it" (45 s) — the moment

Scroll to the **truth map**. Three rows are flagged, and each one came from comparing documents
against each other:

| Row | What the agent spotted |
|---|---|
| **Name** | Her CV says *Ananya Nair*. Her diploma and her council registration say *ANANYA RAJAN NAIR*. |
| **Experience, Amrita** | Her CV says she started in **March 2021**. The employer's own letter says **14 June 2021**. |
| **German level** | She claims **A2**. There is no certificate anywhere in her file. |

Say the line that matters: **a document can verify a claim; nothing else can.** The CV said A2, the
video said A2, and the agent still refuses to call it proven, because no certificate exists.

The two questions under the screen are the only two it will ask. Answer the name one — the agent
takes the fix and moves on.

### 3 · "It plans, with sources" (40 s)

**Readiness** is on Home: 58%, five meters. Then open **Plan** for the **gap plan**. Each gap carries
what, where, how long, how much — and the Educaro service that fixes it:

- German B1 then B2 → the online A1–B2 course, ~13 weeks per level
- Recognition of her diploma → Anerkennung support, 3–4 months for the decision
- Passport missing, name mismatch, CV/letter mismatch → each with its own fix

Open the **trace** in the staff view if anyone asks "how do you know": every number has a source,
and every web fact has a page the agent really opened in that run plus the sentence it quoted.

**The honest bit worth saying out loud:** Educaro's real Nursing Program needs a B.Sc. Nursing, and
Ananya has a GNM diploma. The agent does not pretend. It routes her to the Ausbildung programme —
paid training, three years, and she comes out with the German qualification itself, so no
recognition procedure at all. A brochure would have sold her the wrong product.

### 4 · "It acts, and a human taps" (35 s)

Switch to **staff** (`/staff`).

- **Pipeline**: both applicants as cards with readiness, open gaps, conflicts.
- **Approval queue**: the letter the agent drafted. Open it — every sentence shows the facts behind
  it. Nothing has been sent. Approve it and watch it go.
- **Mail tracker**: the mail appears here *and* in the Gmail inbox. Safe mode means a prototype
  never writes to a real hospital — a third-party recipient is redirected to the team mailbox, and
  the tracker shows a badge saying so.

Then hit **simulate reply → interview** on Ananya. In one tick the agent reads the reply, classifies
it as an interview invitation, puts it in her calendar with an `.ics`, moves her card to *matched*,
and tells her — on her screen, by email, and in Discord.

### 5 · "It lives where she lives" (20 s)

In Discord, run **`/status`**, then **`/next`**, then **`/ask how long until I can work in Germany`**.
Same agent, same facts, no app to open. `#educaro-cohort` already has the ten source pages a plan
cites, grouped by topic.

If you have ten seconds more: **Inbox → New in Germany**, the tab beside her cohort thread. Real
openings pulled from the Bundesagentur für Arbeit for the roles this cohort is actually taking, plus
new programmes and any deadline closing inside eight weeks. It republishes itself every Monday, and
each item can be replied to — the replies are where a cohort is worth having.

> Everyone in that channel was running the same search alone, badly, in a language they are still
> learning. The agent was already reading these sources to build individual plans; posting what is
> new once, to all of them, costs nothing extra.

---

## Three more, if you have the time (90 s)

These are the ones a jury has not seen before. Pick one, not all three.

### "Someone sent me this. Is it real?"

The strongest 30 seconds in the build. Paste a realistic fake offer into the check — a `.tk` domain,
a gmail address on a company letterhead, Western Union, "only today", a fee before any contract.

It lands on the **Safety** tab (with a dot on it, because a high-risk check is something waiting on
her). It comes back **0 out of 100, high risk**, naming each signal, *and* flags three clauses from the
same message — the employer keeping the passport and a twelve-month probation are not merely unfair,
they are unenforceable in Germany. The agent then says so in chat rather than leaving it on a page.

Then run the same check against RWTH: **85 out of 100, looks legitimate.** The point is that it
discriminates, not that it is suspicious of everything.

> Indian applicants are the most defrauded group in this entire process. The checks that settle it
> are boring and cheap. Nobody runs them because nobody tells you which ones matter.

### The honest preview

Open **Plan** and scroll to **what this route is actually like**: shift patterns, pay after
tax and rent, money sent home — and *"8 in 10 alumni say the first three months were the hardest,
and it was the language at speed on a ward, not the exam."*

> Everything else an applicant reads is written by somebody who wants them to go, us included. So
> people cost the visa and not the first winter. This is a strange thing for a company that gets
> paid when people go — and it is the reason to believe the rest of the screen.

### Where they would actually live

Open **Life**. The **rooms** block: twelve places across real districts, each with the rent, the commute to the
hospital or campus, and whether it fits *her* budget. Tap one and Google Maps opens with
public-transport directions from that room to that workplace.

> A room 80 euros cheaper and 50 minutes each way is not cheaper. It is two hours of a nursing
> shift, five days a week, in a country where she cannot yet make that time back socially.

---

## Showing it from your laptop (ngrok)

For a judge on their own phone, or a presenter who is not the person running the stack. Your laptop
stays the server; ngrok gives it a public https URL.

```bash
docker compose up -d                       # pg, redis, mailpit
npm run dev:api                            # :3000
npm run build -w @educaro/web              # the real bundle
npm run preview -w @educaro/web            # :4173, proxies /api and /socket.io to :3000
ngrok http 4173                            # -> https://<something>.ngrok-free.app
```

Open the ngrok URL. **Only tunnel port 4173, not 3000** — the preview server already proxies the API
and the websocket on the same origin, so one tunnel covers everything and nothing is hardcoded.

`vite preview` is deliberate over `vite dev`: it is the production bundle, and there is no HMR socket
to fail over a tunnel. If you do want `dev` through ngrok, set `TUNNEL_HOST` so HMR uses the tunnel:

```bash
TUNNEL_HOST=<something>.ngrok-free.app npm run dev:web
```

Worth knowing before you rely on it:

- **The free tier shows an interstitial** on first visit — a judge has to click through a warning
  page with your ngrok URL on it. `ngrok config add-authtoken` and a paid plan remove it.
- **Your laptop is the server.** Sleep, wifi drop or a closed lid ends the demo for everyone.
- **The URL changes every restart** unless you have a reserved domain.
- **It is a public URL.** The seeded personas are fictional, but anyone with the link reaches your
  machine while it runs. Stop the tunnel afterwards.
- Mailpit on :8025 needs its own tunnel if you want to show the mail tracker externally.

---

## If it all goes wrong on the night

```bash
npm run sandbox
```

The whole product with no keys, no outbound network, stand-in sources and Mailpit only. Everything
still works; only the written copy drops to templates. Say so out loud if you use it — the fallbacks
being real is the point, not an excuse.

```bash
npm run smoke
```

70 end-to-end checks against the live API in about two minutes. Run it before you present. Then
`npm run seed` to put the demo data back, because the smoke test writes.

---

## If something is asked

**"Is this calling an LLM for everything?"**
No. Grades, CEFR maths, Chancenkarte points, readiness, deadlines, matching filters and the whole
truth-map comparison are computed in code. The model picks the order of blocks and writes the
words. Every model-backed feature has a rule-based fallback, so the product still works with no key
at all — the whole flow you just watched was first built and tested with zero keys.

**"What does a run cost?"**
Staff → **stats** shows spend per applicant. The cheap tier is Groq's free `gpt-oss-120b`; OpenAI is
reserved for supervisor plans and letters, under a hard cap of `OPENAI_BUDGET_USD`. Every response
is cached by prompt hash, so a rehearsal costs nothing the second time.

**"Could it invent a requirement?"**
No, by construction. A web fact is only saved if the page was opened in that same run *and* the
quote is found on it. The sources it cites during the demo are served from `/api/mock/<slug>` so a
3-minute demo does not depend on the live internet or on a university editing its page overnight —
point `url` at the real page in the catalogue and the identical code path runs.

**"What is not finished?"**
The MCP server is a real server and the guards travel with its tools, but our own harness still
calls them in-process rather than over the protocol. Retrieval over the applicant's documents is
lexical (BM25) rather than embedded — deliberate for five short documents full of rare exact tokens,
but it is not what the pgvector column was put there for. Those are the two honest gaps.

---

## Reset between runs

```bash
npm run seed                         # rebuilds both personas from scratch
```

Mailpit keeps everything at http://localhost:8025 — clear it there if you want a clean inbox.
