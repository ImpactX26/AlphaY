/**
 * Signs in as a real account in a real browser and answers one question: can this person upload a
 * video, right now, without knowing where to look?
 *
 *   node tools/verify-upload.mjs <email> <password>
 *
 * Screenshots land in tools/.shots/ so the answer is visible, not asserted.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('usage: node tools/verify-upload.mjs <email> <password>');
  process.exit(2);
}

const WEB = process.env.WEB_URL || 'http://localhost:5173';
const SHOTS = 'tools/.shots';
mkdirSync(SHOTS, { recursive: true });

const C = { ok: '\x1b[32m', bad: '\x1b[31m', dim: '\x1b[2m', off: '\x1b[0m' };
const say = (good, msg, detail = '') =>
  console.log(`${good ? C.ok + 'ok  ' : C.bad + 'FAIL'}${C.off} ${msg} ${C.dim}${detail}${C.off}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 950 },
  permissions: [], // no camera: this must work for someone who uploads a file instead
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 140)));

let failed = 0;
const check = (good, msg, detail) => {
  say(good, msg, detail);
  if (!good) failed += 1;
};

try {
  // ---- sign in ----
  await page.goto(WEB, { waitUntil: 'networkidle', timeout: 45_000 });
  await page.screenshot({ path: `${SHOTS}/1-landing.png` });

  // The form is behind a button on the landing card. `--new` registers instead of signing in,
  // because "I made an account and went to upload a video" is the flow that was broken.
  const fresh = process.argv.includes('--new');
  const label = fresh ? /create an account/i : /sign in with email/i;
  const openForm = page.getByRole('button', { name: label }).first();
  if (await openForm.count()) {
    await openForm.click();
    await page.waitForTimeout(600);
  }

  // The fields carry labels, not names.
  const nameBox = page.getByLabel(/your name/i).first();
  if (await nameBox.count()) await nameBox.fill('Pradyumna Test');
  const emailBox = page.locator('input[type="email"]').first();
  await emailBox.waitFor({ timeout: 20_000 });
  await emailBox.fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();

  await page.waitForURL(/\/app/, { timeout: 45_000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {});
  // Wait for real content: screenshotting during the skeletons proves nothing.
  await page.locator('h1, h2').first().waitFor({ timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/2-home.png`, fullPage: true });
  check(/\/app/.test(page.url()), 'signed in', page.url());

  // ---- is there a *recorder* on the page you land on? ----
  // A document drop is not a recorder. The only thing that counts is a control that starts the
  // camera, because that is the step the product asks for by name in its own headline.
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const recorder = page.getByRole('button', { name: /record in the browser|start recording/i });
  const picker = page.getByRole('button', { name: /upload a video file/i });
  const recorderCount = await recorder.count();
  const pickerCount = await picker.count();
  const fileInputs = await page.locator('input[type="file"]').count();

  check(recorderCount > 0 && pickerCount > 0, 'Home offers both a camera and a file, where the headline asks for a video', `${recorderCount} camera, ${pickerCount} file picker, ${fileInputs} input(s)`);
  console.log(`${C.dim}     headline: ${body.slice(0, 150)}${C.off}`);

  // ---- if Home offers a "Record video" action, does it land somewhere that can record? ----
  const recordCta = page.getByRole('button', { name: /record video/i }).first();
  if (await recordCta.count()) {
    await recordCta.click();
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await page.screenshot({ path: `${SHOTS}/3-after-record-click.png`, fullPage: true });
    const inputsThere = await page.locator('input[type="file"]').count();
    const recordThere = await page.getByRole('button', { name: /record|start recording/i }).count();
    check(inputsThere > 0 || recordThere > 0, '"Record video" lands somewhere that can record', `${page.url()} — ${inputsThere} file input(s), ${recordThere} record button(s)`);
  }

  // ---- actually upload one ----
  const input = page.locator('input[type="file"]').first();
  if (await input.count()) {
    const webm = process.env.SAMPLE_VIDEO || 'storage/4fb9d9f6-e8e8-42dc-ae13-58c013e2decd/036c271e-468e-46ba-b394-3beb8cf03eb3-voice-note.webm';
    await input.setInputFiles(webm);
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${SHOTS}/4-after-upload.png`, fullPage: true });
    const after = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    const landed = /uploaded|reading|listening|received|your files|transcript/i.test(after);
    check(landed, 'the upload is acknowledged on screen', after.slice(0, 120));

    // The upload only counts if the agent actually heard it. Poll from inside the page, so this
    // uses the same session the browser has rather than a token minted on the side.
    const transcript = await page.evaluate(async () => {
      const token = localStorage.getItem('educaro.token');
      const me = await (await fetch('/api/auth/me', { headers: { authorization: `Bearer ${token}` } })).json();
      for (let i = 0; i < 30; i += 1) {
        const r = await fetch(`/api/applicants/${me.applicantId}/transcript`, { headers: { authorization: `Bearer ${token}` } });
        const t = r.ok ? await r.json() : null;
        if (t?.text) return t;
        await new Promise((res) => setTimeout(res, 4000));
      }
      return null;
    });
    check(Boolean(transcript?.text), 'the video was transcribed', transcript ? `${transcript.provider}: "${transcript.text.slice(0, 70)}"` : 'no transcript after 2 minutes');
    await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/5-after-transcript.png`, fullPage: true });
  } else {
    check(false, 'there is a file input to upload into', 'none found anywhere');
  }

  check(errors.length === 0, 'no console errors', errors.slice(0, 2).join(' | '));
} catch (e) {
  check(false, 'the run got through', e.message.split('\n')[0].slice(0, 160));
  await page.screenshot({ path: `${SHOTS}/error.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

console.log(`\n${failed ? C.bad : C.ok}${failed ? `${failed} broken` : 'video upload works'}${C.off}  ${C.dim}screenshots in ${SHOTS}/${C.off}`);
process.exit(failed ? 1 : 0);
