#!/usr/bin/env node
/**
 * Rehearses the eight beats of the 3-minute demo script, in order, in a real browser.
 * It proves the path a presenter will walk, and fails loudly on the beat that broke.
 *
 *   node apps/web/scripts/rehearse.mjs                 # against the dev server on :5173
 *   node apps/web/scripts/rehearse.mjs http://host:5173
 *   SHOTS=1 node apps/web/scripts/rehearse.mjs         # also write a screenshot per beat
 *
 * Needs playwright with a chromium build:  npx playwright install chromium
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '');
const SHOTS = process.env.SHOTS === '1';
const OUT = process.env.SHOT_DIR || 'apps/web/.rehearsal';

const C = { ok: '\u001b[32m', bad: '\u001b[31m', dim: '\u001b[2m', off: '\u001b[0m' };
const results = [];
const problems = [];
let shot = 0;

async function beat(at, what, run) {
  const started = Date.now();
  try {
    const note = await run();
    results.push({ at, what, note, ms: Date.now() - started });
    console.log(`${C.ok}✓${C.off} ${at}  ${what}${note ? `${C.dim}  — ${note}${C.off}` : ''}`);
  } catch (err) {
    problems.push({ at, what, why: err?.message ?? String(err) });
    console.log(`${C.bad}✗ ${at}  ${what}${C.off}\n   ${String(err?.message ?? err).split('\n')[0]}`);
  }
}

function expect(ok, why) {
  if (!ok) throw new Error(why);
}

/** Switch persona in the same tab, so mock state carries across the demo. */
async function signInAs(page, name) {
  if (!/\/login$/.test(new URL(page.url()).pathname)) {
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await page.waitForURL(/login|\/$/, { timeout: 15_000 });
  }
  await page.waitForTimeout(600);
  await page.getByRole('button', { name }).click();
}

async function capture(page, label) {
  if (!SHOTS) return;
  await mkdir(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${String(++shot).padStart(2, '0')}-${label}.png`, fullPage: true });
}

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chromium' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(e.message));
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

console.log(`\nRehearsing the demo against ${BASE}\n`);

await beat('0:00', 'Ananya signs in; her story is already uploaded', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Ananya Nair/ }).click();
  await page.waitForURL(/\/app/, { timeout: 15_000 });
  await page.waitForTimeout(1800);
  const headline = await page.locator('h1.headline').first().textContent();
  expect(Boolean(headline?.includes('Ananya')), 'her screen has no headline naming her');
  await capture(page, 'ananya-home');
  return headline?.slice(0, 60);
});

await beat('0:10', 'Replay: the screen starts empty and fills while the files are read', async () => {
  await page.getByRole('button', { name: 'Account menu' }).click();
  const replay = page.getByRole('menuitem', { name: /Replay the intake live/ });
  expect((await replay.count()) > 0, 'no replay tool in the account menu (is mock mode on?)');
  await replay.click();
  await page.waitForTimeout(1400);
  const reading = await page.getByText(/Reading|Transcribing/).count();
  expect(reading > 0, 'nothing showed as being read');
  await capture(page, 'filling');
  await page.waitForTimeout(12_000);
  return 'files read live';
});

await beat('0:25', 'The truth map lights up; exactly two questions are asked', async () => {
  const conflicts = await page.getByText('Conflict').count();
  expect(conflicts >= 2, `expected the experience and name conflicts, saw ${conflicts}`);
  const questions = await page.locator('h1.headline ~ div').getByText(/^(One question|And one more)$/).count();
  expect(questions === 2, `the guard allows two open questions, saw ${questions}`);
  await capture(page, 'truth-map');
  return `${conflicts} conflicts, ${questions} questions`;
});

await beat('0:40', 'She answers the experience conflict and the CV is fixed', async () => {
  await page.getByRole('button', { name: 'The letter. Fix my CV' }).click();
  await page.waitForTimeout(2600);
  expect((await page.getByText('Jul 2021 to Aug 2024 (fixed)').count()) > 0, 'the CV row was not corrected');
  await capture(page, 'answered');
  return 'CV now matches the letter';
});

await beat('0:50', 'Rohan: a completely different screen from the same app', async () => {
  const rohanCtx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
  const other = await rohanCtx.newPage();
  other.on('pageerror', (e) => consoleErrors.push(e.message));
  await other.goto(BASE, { waitUntil: 'networkidle' });
  await other.getByRole('button', { name: /Rohan Mehta/ }).click();
  await other.waitForURL(/\/app/, { timeout: 15_000 });
  await other.waitForTimeout(1800);
  const headline = await other.locator('h1.headline').first().textContent();
  expect(Boolean(headline?.includes('1.9')), 'his headline does not mention the converted grade');
  await capture(other, 'rohan-home');

  await beat('1:10', 'He shortlists a programme; the matrix shows APS missing, with links', async () => {
    await other.getByRole('button', { name: 'Shortlist' }).first().click();
    await other.waitForTimeout(6000);
    expect((await other.getByText('APS certificate').count()) > 0, 'no APS row in the matrix');
    expect((await other.getByText('Start now').count()) > 0, 'APS is not flagged as start now');
    expect((await other.locator('a[href*="aps-india.de"]').count()) > 0, 'the APS row has no source link');
    await capture(other, 'rohan-matrix');
    return 'matrix built from their own page';
  });
  await rohanCtx.close();
  return headline?.slice(0, 60);
});

await beat('1:35', 'Ananya’s German gap routes to an Educaro course and the ÖSD exam', async () => {
  await page.getByRole('link', { name: 'Plan', exact: false }).first().click();
  await page.waitForTimeout(1600);
  expect((await page.getByText(/German B1, then B2/).count()) > 0, 'no German gap plan');
  expect((await page.locator('a[href*="educaro.de/sprachkurse"]').count()) > 0, 'the gap does not route to the Educaro course');
  await capture(page, 'gap-plan');
  return 'gap → Educaro course + ÖSD';
});

await beat('1:55', 'The Bewerbung: keywords highlighted, she approves, it is sent', async () => {
  await page.getByRole('link', { name: 'Home', exact: false }).first().click();
  await page.waitForTimeout(1200);
  const review = page.getByRole('button', { name: /Review and send/ }).first();
  await review.waitFor({ state: 'visible', timeout: 20_000 });
  await review.click();
  await page.waitForURL(/approvals/, { timeout: 15_000 });
  await page.waitForTimeout(900);
  const marks = await page.locator('mark').count();
  expect(marks >= 5, `expected the target's keywords highlighted, saw ${marks}`);
  expect((await page.getByText('You said').count()) > 0, 'no source facts beside the sentences');
  await capture(page, 'letter');
  await page.getByRole('button', { name: /Approve and send/ }).click();
  await page.waitForURL(/inbox/, { timeout: 15_000 });
  await page.waitForTimeout(1400);
  expect((await page.getByText(/Bewerbung: Pflegefachkraft/).count()) > 0, 'the sent mail is not in her inbox');
  await capture(page, 'sent');
  return `${marks} keywords highlighted, then sent`;
});

await beat('2:20', 'A reply invites her to interview: calendar, screen and Discord', async () => {
  await page.getByRole('link', { name: 'Home', exact: false }).first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: /Simulate an interview invite/ }).click();
  await page.waitForTimeout(4000);
  const headline = await page.locator('h1.headline').first().textContent();
  expect(Boolean(headline?.includes('wants to meet you')), 'the screen did not lead on the interview');
  expect((await page.getByText(/Interview booked/).count()) > 0, 'no Discord ping in the chat');
  await capture(page, 'interview');
  await page.getByRole('link', { name: 'Inbox', exact: false }).first().click();
  await page.waitForTimeout(1600);
  expect((await page.getByText('Interview invite').count()) > 0, 'the reply was not classified');
  expect((await page.getByText(/Interview with Rheinpflege/).count()) > 0, 'no calendar event');
  await capture(page, 'calendar');
  return 'classified, in her calendar, pinged on Discord';
});

await beat('2:40', 'The command centre: her card moved, and the trace shows every source', async () => {
  const staff = page;
  await signInAs(staff, /Educaro staff/);
  await staff.waitForURL(/\/staff/, { timeout: 15_000 });
  await staff.waitForTimeout(1600);
  await capture(staff, 'pipeline');
  await staff.getByRole('link', { name: 'Ananya Nair' }).first().click();
  await staff.waitForURL(/applicants/, { timeout: 15_000 });
  await staff.waitForTimeout(1600);
  await staff.getByRole('tab', { name: 'Trace' }).click();
  await staff.waitForTimeout(1200);
  const rows = await staff.locator('ol > li').count();
  expect(rows > 10, `the trace looks thin: ${rows} rows`);
  const sources = await staff.getByText(/sources opened/).textContent();
  await capture(staff, 'trace');
  return `${rows} trace rows · ${sources?.trim()}`;
});

await browser.close();

const total = results.reduce((sum, r) => sum + r.ms, 0);
console.log(`\n${results.length} of ${results.length + problems.length} beats ran, in ${(total / 1000).toFixed(0)}s of browser time.`);
if (consoleErrors.length) {
  console.log(`\n${C.bad}${consoleErrors.length} console error(s):${C.off}`);
  for (const e of [...new Set(consoleErrors)].slice(0, 10)) console.log(`   ${e}`);
}
if (problems.length) {
  console.log(`\n${C.bad}Broken beats:${C.off}`);
  for (const p of problems) console.log(`   ${p.at} ${p.what}\n      ${p.why}`);
}
if (SHOTS) console.log(`\nScreenshots in ${OUT}/`);
process.exit(problems.length || consoleErrors.length ? 1 : 0);
