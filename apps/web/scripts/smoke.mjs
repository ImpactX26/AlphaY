#!/usr/bin/env node
/**
 * Integration smoke test: does the real API give the web app what it reads?
 *
 *   node apps/web/scripts/smoke.mjs                      # against http://localhost:3000
 *   node apps/web/scripts/smoke.mjs http://host:3000
 *
 * For each endpoint it reports the status, and which of the fields the web app
 * actually uses are missing or null. It only reads; nothing is sent anywhere.
 */
const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const API = `${BASE}/api`;

let token = null;
let applicantId = null;
let staffToken = null;

const pass = [];
const warn = [];
const fail = [];

const C = { ok: '\u001b[32m', warn: '\u001b[33m', bad: '\u001b[31m', dim: '\u001b[2m', off: '\u001b[0m' };

async function call(method, path, { body, as } = {}) {
  const headers = { Accept: 'application/json' };
  const auth = as === 'staff' ? staffToken : as === 'none' ? null : token;
  if (auth) headers.Authorization = `Bearer ${auth}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: String(err?.message ?? err) };
  }
}

/** `fields` are the ones the web app reads. A missing one breaks a screen. */
function check(label, { status, data }, fields = [], { allowNull = false } = {}) {
  if (status === 0) {
    fail.push(`${label} — cannot reach the API (${data})`);
    return null;
  }
  if (status === 404) {
    warn.push(`${label} — 404, not built yet`);
    return null;
  }
  if (status >= 400) {
    fail.push(`${label} — HTTP ${status}${typeof data?.message === 'string' ? `: ${data.message}` : ''}`);
    return null;
  }
  const sample = Array.isArray(data) ? data[0] : data;
  if (!sample) {
    if (allowNull) pass.push(`${label} — ${status}, empty`);
    else warn.push(`${label} — ${status} but no rows, cannot check fields`);
    return data;
  }
  const missing = fields.filter((f) => !(f in sample));
  const nulls = fields.filter((f) => f in sample && sample[f] === null);
  if (missing.length) fail.push(`${label} — missing ${missing.join(', ')}`);
  else if (nulls.length) pass.push(`${label} — ${status}${C.dim} (null: ${nulls.join(', ')})${C.off}`);
  else pass.push(`${label} — ${status}`);
  return data;
}

async function main() {
  console.log(`\nEducaro API smoke test → ${API}\n`);

  check('GET /system/status', await call('GET', '/system/status', { as: 'none' }), ['llm', 'discord', 'mailpitUrl']);

  const auth = await call('POST', '/auth/demo', { body: { persona: 'ananya' }, as: 'none' });
  check('POST /auth/demo (ananya)', auth, ['token', 'user']);
  token = auth.data?.token ?? null;
  applicantId = auth.data?.user?.applicantId ?? null;
  if (!token) {
    report();
    console.log(`\n${C.bad}No token, so the rest cannot be checked. Is /auth/demo built?${C.off}\n`);
    process.exit(1);
  }
  console.log(`${C.dim}signed in as ${auth.data.user.name} (${applicantId})${C.off}\n`);

  check('GET /auth/me', await call('GET', '/auth/me'), ['userId', 'role', 'name', 'applicantId']);

  const a = `/applicants/${applicantId}`;
  check(`GET ${a}`, await call('GET', a), ['id', 'name', 'route', 'stage', 'mode', 'staffSecondKey']);
  const screen = check(`GET ${a}/screen`, await call('GET', `${a}/screen`), ['applicantId', 'version', 'mode', 'headline', 'footnote', 'blocks', 'composedBy']);
  if (screen?.blocks?.length) {
    const kinds = [...new Set(screen.blocks.map((b) => b.type))];
    const known = new Set([
      'next_step', 'question', 'checklist', 'documents', 'truth_map', 'route', 'opportunities', 'shortlist',
      'requirement_matrix', 'gap_plan', 'readiness', 'budget', 'timeline', 'services', 'places', 'letters', 'arrival', 'note',
    ]);
    const unknown = kinds.filter((k) => !known.has(k));
    if (unknown.length) fail.push(`screen.blocks — unknown block types: ${unknown.join(', ')} (the renderer has no component for these)`);
    else pass.push(`screen.blocks — ${screen.blocks.length} blocks, types: ${kinds.join(', ')}`);
    const noId = screen.blocks.filter((b) => !b.id);
    if (noId.length) fail.push(`screen.blocks — ${noId.length} block(s) have no id (React keys and the enter animation need it)`);
  }

  check(`GET ${a}/files`, await call('GET', `${a}/files`), ['id', 'originalName', 'kind', 'status'], { allowNull: true });
  check(`GET ${a}/transcript`, await call('GET', `${a}/transcript`), ['fileId', 'text', 'segments', 'provider'], { allowNull: true });
  check(`GET ${a}/facts`, await call('GET', `${a}/facts`), ['id', 'key', 'label', 'value', 'tag', 'sourceKind']);
  check(`GET ${a}/truth-map`, await call('GET', `${a}/truth-map`), ['key', 'label', 'video', 'cv', 'document', 'status', 'note']);
  check(`GET ${a}/questions`, await call('GET', `${a}/questions`), ['id', 'prompt', 'why', 'options', 'status'], { allowNull: true });
  check(`GET ${a}/chat`, await call('GET', `${a}/chat`), ['id', 'author', 'channel', 'text', 'createdAt'], { allowNull: true });
  const shortlist = check(`GET ${a}/shortlist`, await call('GET', `${a}/shortlist`), ['id', 'kind', 'title', 'status', 'gapCount', 'matrix'], { allowNull: true });
  const matrix = Array.isArray(shortlist) ? shortlist.find((s) => s.matrix)?.matrix : null;
  if (matrix) check('shortlist[].matrix', { status: 200, data: matrix }, ['rows', 'exams', 'deadline']);
  check(`GET ${a}/gaps`, await call('GET', `${a}/gaps`), ['id', 'title', 'what', 'where', 'howLong', 'cost', 'links', 'status'], { allowNull: true });
  check(`GET ${a}/readiness`, await call('GET', `${a}/readiness`), ['overall', 'outcome', 'meters']);
  const approvals = check(`GET ${a}/approvals`, await call('GET', `${a}/approvals`), ['id', 'kind', 'title', 'status', 'needsStaff'], { allowNull: true });
  check(`GET ${a}/emails`, await call('GET', `${a}/emails`), ['id', 'direction', 'fromAddr', 'toAddr', 'subject', 'text', 'threadKey'], { allowNull: true });
  check(`GET ${a}/calendar`, await call('GET', `${a}/calendar`), ['id', 'title', 'kind', 'startsAt', 'durationMin'], { allowNull: true });

  const approvalId = Array.isArray(approvals) ? approvals[0]?.id : null;
  if (approvalId) {
    const detail = check(`GET /approvals/${approvalId}`, await call('GET', `/approvals/${approvalId}`), ['id', 'payload', 'facts', 'status']);
    const p = detail?.payload;
    if (p && detail.kind === 'email') {
      const need = ['to', 'subject', 'body', 'sentences', 'keywords', 'attachments'];
      const missing = need.filter((f) => !(f in p));
      if (missing.length) fail.push(`approval.payload (letter) — missing ${missing.join(', ')} (letter review needs these)`);
      else pass.push('approval.payload (letter) — complete');
      if (Array.isArray(p.sentences) && p.sentences.length && !('factIds' in p.sentences[0]))
        fail.push('approval.payload.sentences[] — no factIds, so sources cannot show beside each sentence');
    }
  } else {
    warn.push('no pending approval to check the letter payload against');
  }

  // staff
  const staffAuth = await call('POST', '/auth/demo', { body: { persona: 'staff' }, as: 'none' });
  staffToken = staffAuth.data?.token ?? null;
  if (!staffToken) {
    warn.push('POST /auth/demo (staff) gave no token, so the staff endpoints were skipped');
  } else {
    console.log(`${C.dim}signed in as staff (${staffAuth.data.user.name})${C.off}\n`);
    check('GET /staff/pipeline', await call('GET', '/staff/pipeline', { as: 'staff' }), ['applicantId', 'name', 'stage', 'readiness', 'openGaps', 'pendingApprovals', 'conflicts']);
    check('GET /staff/queue', await call('GET', '/staff/queue', { as: 'staff' }), ['id', 'kind', 'applicantId', 'applicantName', 'title', 'detail'], { allowNull: true });
    check('GET /staff/openings', await call('GET', '/staff/openings', { as: 'staff' }), ['id', 'employer', 'title', 'city', 'route', 'germanLevel', 'startDate', 'keywords'], { allowNull: true });
    check('GET /staff/batch-planner', await call('GET', '/staff/batch-planner', { as: 'staff' }), ['months', 'totals']);
    check('GET /staff/broadcasts', await call('GET', '/staff/broadcasts', { as: 'staff' }), ['id', 'topic', 'status', 'messages'], { allowNull: true });
    check('GET /staff/trace', await call('GET', '/staff/trace?limit=20', { as: 'staff' }), ['id', 'kind', 'name', 'detail', 'costUsd', 'createdAt'], { allowNull: true });
    check('GET /staff/mail-tracker', await call('GET', '/staff/mail-tracker?limit=20', { as: 'staff' }), ['mailpitId', 'direction', 'from', 'to', 'originalTo', 'subject', 'safeRedirected'], { allowNull: true });
    check('GET /staff/stats', await call('GET', '/staff/stats', { as: 'staff' }), ['llm', 'applicants', 'costPerApplicant']);
    if (applicantId) check(`GET /staff/applicants/${applicantId}/brief`, await call('GET', `/staff/applicants/${applicantId}/brief`, { as: 'staff' }), ['who', 'route', 'openGaps', 'agentTried', 'questionsToAsk']);
    check('POST /staff/copilot', await call('POST', '/staff/copilot', { body: { query: 'nurses with B1' }, as: 'staff' }), ['query', 'interpretation', 'columns', 'rows', 'applicantIds']);
  }

  report();
  process.exit(fail.length ? 1 : 0);
}

function report() {
  for (const line of pass) console.log(`${C.ok}ok${C.off}    ${line}`);
  for (const line of warn) console.log(`${C.warn}todo${C.off}  ${line}`);
  for (const line of fail) console.log(`${C.bad}FAIL${C.off}  ${line}`);
  console.log(`\n${pass.length} ok · ${warn.length} not built yet · ${fail.length} broken\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
