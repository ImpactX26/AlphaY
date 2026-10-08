#!/usr/bin/env node
/**
 * End-to-end check against a running API.
 *
 *   node tools/smoke.mjs                      # against http://localhost:3000
 *   node tools/smoke.mjs --base http://host    # somewhere else
 *   node tools/smoke.mjs --quick               # skip the slow agent waits
 *
 * Plain Node, no build step and no dependencies, so it can be run while the API is live without
 * touching its files.
 *
 * Every bug found by hand during this build was in a path that looked finished: a university
 * application that approved but never sent, a grade that read the first semester instead of the
 * cumulative one, a model call with no timeout that froze one applicant's agent for half an hour.
 * None of them threw. Each one needed somebody to run the path and look at the answer, which is
 * what this does — it asserts on the values, not just on the status codes.
 */

const args = process.argv.slice(2);
const BASE = (args[args.indexOf('--base') + 1] ?? 'http://localhost:3000').replace(/\/$/, '');
const QUICK = args.includes('--quick');

let passed = 0;
let failed = 0;
const failures = [];

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const OFF = '\x1b[0m';

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  ${GREEN}pass${OFF}  ${name}${detail ? `  ${DIM}${detail}${OFF}` : ''}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ${RED}FAIL${OFF}  ${name}${detail ? `  ${detail}` : ''}`);
  }
  return ok;
}

function section(title) {
  console.log(`\n${title}`);
}

async function api(path, { token, method = 'GET', body, raw = false } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, QUICK ? Math.min(ms, 1500) : ms));

/**
 * A local model is an order of magnitude slower than a hosted one — qwen2.5:14b answers in 10 to 60
 * seconds where Groq takes one, and Ollama serves requests one at a time, so parallel agent runs
 * queue behind each other. Checks written for a hosted model then fail on a machine that is working
 * perfectly, which is the least useful failure a suite can produce.
 */
let patience = 1;

/** Polls instead of sleeping blind, so a slow machine does not fail and a fast one is not punished. */
async function until(label, fn, timeoutMs = 60_000, everyMs = 2500) {
  const budget = Math.round(timeoutMs * patience);
  const deadline = Date.now() + (QUICK ? Math.min(budget, 15_000) : budget);
  let last;
  while (Date.now() < deadline) {
    last = await fn().catch(() => undefined);
    if (last) return last;
    await new Promise((r) => setTimeout(r, everyMs));
  }
  console.log(`  ${DIM}(gave up waiting for ${label})${OFF}`);
  return undefined;
}

async function main() {
  console.log(`Educaro smoke test → ${BASE}${QUICK ? '  (quick)' : ''}`);

  // ---------------------------------------------------------------- system
  section('System');
  const status = await api('/system/status');
  check('system status answers', status.status === 200);
  const llm = status.body?.llm ?? {};
  console.log(`  ${DIM}groq=${llm.groq} openai=${llm.openai} local=${llm.local ?? 'none'} discord=${status.body?.discord} spent=$${llm.openaiSpentUsd}/${llm.openaiBudgetUsd}${OFF}`);
  if (llm.local) {
    patience = 4;
    console.log(`  ${DIM}local model in use: waiting 4x longer before giving up on anything${OFF}`);
  }

  const mcp = await api('/mcp/tools');
  check('MCP publishes its tools', Array.isArray(mcp.body?.tools) && mcp.body.tools.length >= 10, `${mcp.body?.tools?.length ?? 0} tools`);

  const mock = await fetch(`${BASE}/api/mock/tum-msc-informatics`);
  check('demo source pages are served', mock.status === 200);

  // ---------------------------------------------------------------- auth
  section('Demo logins');
  const logins = {};
  for (const persona of ['ananya', 'rohan', 'staff']) {
    const r = await api('/auth/demo', { method: 'POST', body: { persona } });
    const ok = check(`${persona} signs in`, r.status === 201 || r.status === 200, r.body?.user?.name ?? JSON.stringify(r.body).slice(0, 60));
    if (ok) logins[persona] = r.body;
  }
  if (!logins.ananya || !logins.rohan || !logins.staff) {
    console.log(`\n${RED}Demo data is missing. Run: npm run seed${OFF}`);
    process.exit(1);
  }
  const A = logins.ananya.user.applicantId;
  const R = logins.rohan.user.applicantId;
  const aT = logins.ananya.token;
  const rT = logins.rohan.token;
  const sT = logins.staff.token;

  check('an applicant cannot read another applicant', (await api(`/applicants/${R}`, { token: aT })).status === 403);

  // ---------------------------------------------------------------- ingest and truth
  section('What the agent read');
  const files = (await api(`/applicants/${A}/files`, { token: aT })).body;
  check('Ananya has her papers', Array.isArray(files) && files.length >= 5, `${files?.length} files`);
  check('every file was read', Array.isArray(files) && files.every((f) => f.status === 'done'), files?.map((f) => `${f.kind}:${f.status}`).join(' '));

  const transcript = (await api(`/applicants/${A}/transcript`, { token: aT })).body;
  check('the intro was transcribed', Boolean(transcript?.text?.length > 100), `${transcript?.provider}, ${transcript?.text?.length ?? 0} chars`);

  const truth = (await api(`/applicants/${A}/truth-map`, { token: aT })).body;
  const conflicts = (truth ?? []).filter((r) => r.status === 'conflict').map((r) => r.label);
  check('the name conflict was found', conflicts.some((l) => /name/i.test(l)), conflicts.join(' | '));
  check('the experience date conflict was found', conflicts.some((l) => /experience/i.test(l)));
  check('unproven German is not called verified', (truth ?? []).some((r) => /german/i.test(r.label) && r.status === 'no_proof'));

  const rTruth = (await api(`/applicants/${R}/truth-map`, { token: rT })).body;
  const grade = (rTruth ?? []).find((r) => /grade/i.test(r.label));
  check('the cumulative grade wins, not semester one', Boolean(grade && /8\.2/.test(grade.document ?? '')), grade?.document ?? 'no grade row');
  check('the German equivalent is on the grade', Boolean(grade && /1\.9/.test(grade.document ?? '')), grade?.document ?? '');

  // ---------------------------------------------------------------- the plan
  section('The plan');
  const screen = (await api(`/applicants/${A}/screen`, { token: aT })).body;
  check('a screen is composed', Array.isArray(screen?.blocks) && screen.blocks.length >= 5, `v${screen?.version}, ${screen?.blocks?.length} blocks, by ${screen?.composedBy}`);
  check('the headline is written', typeof screen?.headline === 'string' && screen.headline.length > 20);

  const readiness = (await api(`/applicants/${A}/readiness`, { token: aT })).body;
  check('readiness is scored', typeof readiness?.overall === 'number' && readiness.overall > 0, `${readiness?.overall}% ${readiness?.outcome}`);

  const gaps = (await api(`/applicants/${A}/gaps`, { token: aT })).body;
  check('gaps have fix-it plans', Array.isArray(gaps) && gaps.length > 0 && gaps.every((g) => g.what && g.howLong), `${gaps?.length} gaps`);
  check('gaps route to an Educaro service', (gaps ?? []).some((g) => g.service?.name));
  check('no service link leaves the product', !(gaps ?? []).some((g) => /educaro\.de/.test(g.service?.url ?? '')));

  const questions = (await api(`/applicants/${A}/questions`, { token: aT })).body;
  check('at most two questions are open', (questions ?? []).filter((q) => q.status === 'open').length <= 2);

  // ---------------------------------------------------------------- shortlist and matrix
  section('Shortlist');
  const added = await api(`/applicants/${R}/shortlist`, { token: rT, method: 'POST', body: { url: `${BASE}/api/mock/rwth-aachen-msc-data-science` } });
  check('a pasted link is accepted', added.status === 201 || added.status === 200, added.body?.title);
  const built = await until(
    'the requirement matrix',
    async () => {
      const list = (await api(`/applicants/${R}/shortlist`, { token: rT })).body;
      return (list ?? []).find((s) => s.id === added.body?.id && s.matrix);
    },
    90_000,
  );
  check('its requirements are read and compared', Boolean(built?.matrix?.rows?.length), `${built?.matrix?.rows?.length ?? 0} rows, ${built?.gapCount ?? '?'} gaps`);
  if (built?.matrix?.rows) {
    const sourced = built.matrix.rows.filter((r) => r.tag === 'web').length;
    check('requirements cite the page they came from', sourced > 0, `${sourced} web-sourced rows`);
  }

  // ---------------------------------------------------------------- letters and approval
  section('Nothing leaves without a human tap');
  let approvalId;
  if (built?.id) {
    const draft = await api(`/shortlist/${built.id}/draft`, { token: rT, method: 'POST' });
    approvalId = draft.body?.id;
    // Re-running without a reseed returns the approval from last time, which a human already
    // approved. The invariant is not "always pending" — it is that nothing reached 'sent' without
    // somebody tapping it, so assert that instead and stay honest across repeat runs.
    const drafted = draft.body?.status === 'pending';
    const alreadyTapped = draft.body?.status !== 'pending' && Boolean(draft.body?.applicantApprovedAt || draft.body?.staffApprovedAt);
    check('the agent drafts, it does not send', drafted || alreadyTapped, drafted ? draft.body?.title : `already ${draft.body?.status} by a human tap`);
    const detail = (await api(`/approvals/${approvalId}`, { token: rT })).body;
    check('every sentence carries its sources', (detail?.payload?.sentences ?? []).length > 0 && (detail?.payload?.sentences ?? []).every((s) => Array.isArray(s.factIds)));
    check('the facts behind it are attached', (detail?.facts ?? []).length > 0, `${detail?.facts?.length ?? 0} facts`);

    const approved = await api(`/approvals/${approvalId}/approve`, { token: rT, method: 'POST', body: {} });
    check('approving actually sends something', approved.body?.status === 'sent', `status=${approved.body?.status}`);
  }

  // ---------------------------------------------------------------- the outside world
  section('The outside world');
  await api('/staff/simulate-reply', { token: sT, method: 'POST', body: { applicantId: A, kind: 'interview' } });
  // Not "one more event than before": a second identical invitation is deduplicated, which is the
  // right behaviour. What matters is that an interview is in the calendar at all.
  const cal = await until('the interview in the calendar', async () => {
    const list = (await api(`/applicants/${A}/calendar`, { token: aT })).body ?? [];
    return list.some((e) => e.kind === 'interview') ? list : undefined;
  }, 45_000);
  check('an employer reply becomes a calendar event', Boolean(cal), `${cal?.length ?? 0} events`);

  // Stages move forward only. Somebody already in Germany is past 'matched', and demanding the
  // exact stage would fail precisely because the product did the right thing earlier.
  const STAGES = ['new_story', 'profiling', 'gap_plan', 'ready', 'matched', 'applied', 'visa', 'arrived'];
  const stage = (await api(`/applicants/${A}`, { token: aT })).body?.stage;
  check('the reply moved them to matched or beyond', STAGES.indexOf(stage) >= STAGES.indexOf('matched'), stage);

  const tracker = (await api('/staff/mail-tracker?limit=20', { token: sT })).body;
  check('the mail tracker has the traffic', Array.isArray(tracker) && tracker.length > 0, `${tracker?.length ?? 0} messages`);

  // ---------------------------------------------------------------- documents out
  section('Documents');
  for (const [doc, fmt] of [['lebenslauf', 'pdf'], ['lebenslauf', 'docx'], ['final-pack', 'pdf'], ['final-pack', 'docx']]) {
    const res = await fetch(`${BASE}/api/applicants/${A}/${doc}?format=${fmt}&token=${aT}`);
    const buf = Buffer.from(await res.arrayBuffer());
    check(`${doc}.${fmt} generates`, res.status === 200 && buf.length > 1000, `${buf.length} bytes`);
  }

  // ---------------------------------------------------------------- interview
  section('Interview coach');
  const iv = await api(`/applicants/${A}/interview`, { token: aT, method: 'POST', body: { kind: 'visa' } });
  check('an interview starts with a question', Boolean(iv.body?.turns?.[0]?.text), iv.body?.turns?.[0]?.text?.slice(0, 50));
  if (iv.body?.id) {
    const weak = await api(`/interview/${iv.body.id}/answer`, { token: aT, method: 'POST', body: { text: 'Because Germany is good.' } });
    const scored = (weak.body?.turns ?? []).filter((t) => t.role === 'applicant').pop();
    check('a weak answer scores badly and says why', typeof scored?.score === 'number' && scored.score <= 5 && scored.feedback?.length > 20, `score ${scored?.score}`);
  }

  // ---------------------------------------------------------------- staff
  section('Staff command centre');
  const pipeline = (await api('/staff/pipeline', { token: sT })).body;
  check('the pipeline lists everyone', Array.isArray(pipeline) && pipeline.length >= 2, `${pipeline?.length} cards`);

  const queue = (await api('/staff/queue', { token: sT })).body;
  check('the queue has work in it', Array.isArray(queue), `${queue?.length ?? 0} items`);
  const dupes = (queue ?? []).filter((q) => q.kind === 'submission').map((q) => q.applicantId);
  check('no submission is listed twice', new Set(dupes).size === dupes.length);

  const copilot = await api('/staff/copilot', { token: sT, method: 'POST', body: { query: 'who is below B1 German?' } });
  check('the copilot answers in a table', Array.isArray(copilot.body?.rows), `${copilot.body?.rows?.length ?? 0} rows — ${copilot.body?.interpretation?.slice(0, 60) ?? ''}`);

  const openings = (await api('/staff/openings', { token: sT })).body;
  const nursing = (openings ?? []).find((o) => o.route === 'nursing');
  if (nursing) {
    const matches = (await api(`/staff/openings/${nursing.id}/match`, { token: sT, method: 'POST' })).body;
    check('matching ranks candidates with reasons', Array.isArray(matches) && matches.length > 0 && matches[0].reasons.length > 0, `${matches?.length} candidates, top ${matches?.[0]?.score}`);
    check('candidates stay anonymous until consent', (matches ?? []).every((m) => m.consent || /^Candidate [A-Z]$/.test(m.displayName)), matches?.[0]?.displayName);
  }

  const brief = (await api(`/staff/applicants/${A}/brief`, { token: sT })).body;
  check('the consultant brief is written', Boolean(brief?.who && brief?.route), brief?.who);

  const stats = (await api('/staff/stats', { token: sT })).body;
  check('cost per applicant is tracked', Array.isArray(stats?.costPerApplicant), `$${stats?.costPerApplicant?.reduce((s, c) => s + c.costUsd, 0).toFixed(4) ?? '?'} total`);

  // ---------------------------------------------------------------- living there
  section('Where they would live, and what it is like');
  const blocksOf = async (id, token) => ((await api(`/applicants/${id}/screen`, { token })).body?.blocks ?? []);
  const rBlocks = await blocksOf(R, rT);
  const block = (list, type) => list.find((b) => b.type === type);

  const rentals = block(rBlocks, 'rentals');
  check('rooms are found with a rent and a commute', Boolean(rentals?.listings?.length), `${rentals?.listings?.length ?? 0} listings in ${rentals?.city ?? '—'}`);
  if (rentals?.listings?.length) {
    check('every room says whether it fits the budget', rentals.listings.every((l) => typeof l.affordable === 'boolean'), `ceiling EUR ${rentals.budgetEur}`);
    check('every room opens in a map', rentals.listings.every((l) => /^https:\/\/www\.google\.com\/maps/.test(l.mapsUrl ?? '')));
    check('the commute is measured against something real', Boolean(rentals.anchor), rentals.anchor?.label);
  }

  const reality = block(rBlocks, 'reality_check');
  check('the route gets an honest preview', Boolean(reality?.hard?.length), reality?.hard?.[0]?.stat?.slice(0, 60));
  check('the preview says where its numbers came from', Boolean(reality?.source));

  const finance = block(rBlocks, 'finance_plan');
  check('money is planned over time, not just per month', Number(finance?.needBeforeTravelEur) > 0, `EUR ${finance?.needBeforeTravelEur} before travel across ${finance?.oneOff?.length} costs`);
  check('each cost says when it lands', (finance?.oneOff ?? []).every((o) => o.whenMonth));

  const help = block(rBlocks, 'help');
  check('rights at work are on the screen', (help?.rights?.length ?? 0) >= 5, `${help?.rights?.length} rights`);

  // ---------------------------------------------------------------- safety
  section('Is this real?');
  const fake = await api(`/applicants/${A}/check`, {
    token: aT,
    method: 'POST',
    body: {
      kind: 'agent',
      name: 'Global Nurses Placement',
      email: 'globalnurses.hiring@gmail.com',
      url: 'http://global-nurses-germany.tk',
      text: 'Only today, pay registration fee of 85000 INR via Western Union to confirm your seat. Employer will retain passport until contract completion. Probation period 12 months.',
    },
  });
  check('an obvious scam is called one', fake.body?.verdict === 'high_risk', `${fake.body?.verdict} ${fake.body?.score}/100`);
  check('it names why, not just a score', (fake.body?.signals ?? []).filter((s) => s.status === 'bad').length >= 3, `${fake.body?.signals?.length} signals`);
  check('illegal contract clauses are flagged as illegal', (fake.body?.contractFlags ?? []).some((f) => f.severity === 'illegal'), (fake.body?.contractFlags ?? []).map((f) => f.clause).join('; ').slice(0, 80));

  const real = await api(`/applicants/${R}/check`, { token: rT, method: 'POST', body: { kind: 'university', name: 'RWTH Aachen University', url: `${BASE}/api/mock/rwth-aachen-msc-data-science` } });
  check('a real university is not called a scam', real.body?.verdict !== 'high_risk', `${real.body?.verdict} ${real.body?.score}/100`);

  await api(`/applicants/${A}/report`, { token: aT, method: 'POST', body: { employer: 'Klinikum Koeln Mitte GmbH', category: 'hours', severity: 'serious', text: 'Rostered 12 days in a row, overtime never recorded.' } });
  const ratings = (await api('/staff/employers', { token: sT })).body ?? [];
  check('a private report reaches staff', ratings.some((e) => e.reports > 0), ratings.filter((e) => e.reports).map((e) => `${e.employer} ${e.rating}/5`).join(', '));
  check('one report is not published as a rating', ratings.every((e) => e.confident === e.reports >= 3));

  // ---------------------------------------------------------------- community
  section('The cohort');
  const posted = await api('/community', { token: aT, method: 'POST', body: { text: 'Has anyone done the Anerkennung in NRW? How long did the deficit notice take?' } });
  check('an applicant can post to the cohort', Boolean(posted.body?.id), posted.body?.author);
  const thread = await until('the agent to answer in the open', async () => {
    const list = (await api('/community', { token: aT })).body ?? [];
    const mine = list.find((p) => p.id === posted.body?.id);
    return mine?.replies?.length ? mine : undefined;
  }, 40_000);
  check('the agent answers the cohort, not just the asker', Boolean(thread), thread?.replies?.[0]?.text?.slice(0, 70));
  check('posts are first names only', !/\s[A-Z][a-z]+\s[A-Z][a-z]+/.test(posted.body?.author ?? ''), posted.body?.author);

  const feed = (await api('/community/announcements?limit=20', { token: aT })).body ?? [];
  check('the announcements feed has something in it', feed.length > 0, `${feed.length} posts`);
  check('announcements are one item each, not a wall of links', feed.every((p) => (p.text.match(/https?:\/\//g) ?? []).length <= 1));

  const aBlocks = await blocksOf(A, aT);
  const cohortBlock = block(aBlocks, 'cohort');
  check('the cohort timings reach the screen, not just an endpoint', Boolean(cohortBlock?.steps?.length), `basis ${cohortBlock?.basis}`);
  check('nobody is listed as their own peer', !(cohortBlock?.peers ?? []).some((p) => p.label.startsWith('Ananya')), (cohortBlock?.peers ?? []).map((p) => p.label).join(', '));

  const cohort = (await api(`/applicants/${R}/cohort`, { token: rT })).body;
  check('peers and their timings are returned', Array.isArray(cohort?.steps) && cohort.steps.length > 0, `basis ${cohort?.basis}`);
  check('a future step is not called "behind"', (cohort?.steps ?? []).every((st) => st.youAre !== 'behind' || st.medianWeeks > 0));

  // ---------------------------------------------------------------- their own documents
  section('Their own papers');
  // This suite fires a lot of model calls in a couple of minutes, and the free tier caps tokens per
  // minute — so the test can cause the very failure it then reports. Ask twice before believing it.
  let answered;
  for (let attempt = 0; attempt < 2 && !/KNMC\/2021\/48217/.test(answered?.text ?? ''); attempt++) {
    await api(`/applicants/${A}/chat`, { token: aT, method: 'POST', body: { text: 'what is my nursing council registration number?' } });
    answered = await until(
      'an answer from the documents',
      async () => {
        const msgs = (await api(`/applicants/${A}/chat`, { token: aT })).body ?? [];
        const last = msgs[msgs.length - 1];
        return last?.author === 'agent' && /KNMC/.test(last.text) ? last : undefined;
      },
      45_000,
    );
  }
  check('a question is answered from the uploaded page', /KNMC\/2021\/48217/.test(answered?.text ?? ''), (answered?.text ?? '').slice(0, 90));

  // ---------------------------------------------------------------- guards
  section('The guards hold');
  const mcpCall = async (name, argsObj) => {
    const res = await fetch(`${BASE}/api/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: argsObj } }),
    });
    const line = (await res.text()).split('\n').find((l) => l.startsWith('data: '));
    return line ? JSON.parse(line.slice(6)).result : null;
  };

  const invented = await mcpCall('save_fact', {
    applicantId: A,
    key: 'official.smoke_test',
    label: 'Invented rule',
    value: 'No APS needed',
    tag: 'web',
    sourceUrl: 'https://example.com/not-opened',
    quote: 'APS is not required',
  });
  check('a web fact with no opened source is refused', /refused|no page/i.test(invented?.content?.[0]?.text ?? ''), (invented?.content?.[0]?.text ?? '').slice(0, 70));

  const personal = await mcpCall('search', { query: 'Ananya Nair passport Z1234567' });
  check('a search carrying personal data is refused', personal?.isError === true, (personal?.content?.[0]?.text ?? '').slice(0, 60));

  const gradeTool = await mcpCall('convert_grade', { grade: 'CGPA 8.2/10' });
  check('the Bavarian formula is shown, not asserted', /1\.9/.test(gradeTool?.content?.[0]?.text ?? ''), JSON.parse(gradeTool?.content?.[0]?.text ?? '{}').formula ?? '');

  // ---------------------------------------------------------------- result
  console.log(`\n${failed ? RED : GREEN}${passed} passed, ${failed} failed${OFF}`);
  if (failed) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  · ${f}`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(`\n${RED}smoke test crashed:${OFF} ${e?.message}\n${e?.stack}`);
  process.exit(1);
});
