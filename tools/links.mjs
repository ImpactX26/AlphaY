/**
 * Opens every outward link the product can show, and says which ones are dead.
 *
 * An applicant clicking "Open a blocked account" has to land on a bank, not on a 404. These sites
 * reorganise constantly — `www.aps-india.de` stopped resolving at all while this build was running,
 * and it was cited in five places including two facts the source guard has to open — so the only
 * way to keep the claim honest is to check it.
 *
 * Reads the URLs straight out of `apps/api/src`, so a link added tomorrow is checked tomorrow with
 * no list to maintain here.
 *
 *   node tools/links.mjs            all of them
 *   node tools/links.mjs --dead     only what is broken, for a quick pass before a demo
 *
 * Three outcomes, because they are not the same thing:
 *   ok        the page answered
 *   bot-wall  403/401 from a script. Goethe and ImmobilienScout do this to everyone automated;
 *             they are correct in a browser, so they are reported, not failed.
 *   DEAD      no answer, or 404/500 — the only one that fails the run.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'apps/api/src';
const DEAD_ONLY = process.argv.includes('--dead');

/** Machine endpoints: called by code with keys and parameters, never shown to anybody to click. */
const MACHINE = [
  'api.groq.com', 'api.openai.com', 'api.tavily.com', 'duckduckgo.com', 'overpass', 'nominatim',
  'rest.arbeitsagentur.de', 'discord.com/api', 'api.open-meteo.com', 'localhost', '127.0.0.1',
  'google.com/maps', 'meet.jit.si', 'schema.org', 'www.w3.org', 'example.com',
];

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const found = new Map(); // url -> Set(file)
for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/https?:\/\/[^\s'"`)\\]+/g)) {
    // Trailing punctuation from prose, and template holes we cannot resolve statically.
    const url = m[0].replace(/[.,;:]+$/, '');
    if (url.includes('${') || MACHINE.some((s) => url.includes(s))) continue;
    if (!found.has(url)) found.set(url, new Set());
    found.get(url).add(file.replace(/\\/g, '/'));
  }
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const C = { ok: '\x1b[32m', warn: '\x1b[33m', bad: '\x1b[31m', dim: '\x1b[2m', off: '\x1b[0m' };

async function check(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': UA } });
    if (r.status === 403 || r.status === 401) return { kind: 'bot-wall', detail: String(r.status) };
    if (r.ok) return { kind: 'ok', detail: String(r.status) };
    return { kind: 'dead', detail: String(r.status) };
  } catch (e) {
    return { kind: 'dead', detail: e.name === 'AbortError' ? 'timed out' : e.cause?.code || e.message.slice(0, 40) };
  } finally {
    clearTimeout(t);
  }
}

const urls = [...found.keys()].sort();
console.log(`${C.dim}${urls.length} links shown to applicants, from ${SRC}${C.off}\n`);

const results = await Promise.all(urls.map(async (u) => [u, await check(u)]));
let dead = 0;
let walled = 0;
for (const [url, r] of results) {
  if (r.kind === 'dead') dead += 1;
  if (r.kind === 'bot-wall') walled += 1;
  if (DEAD_ONLY && r.kind !== 'dead') continue;
  const tag =
    r.kind === 'ok' ? `${C.ok}ok      ${C.off}` : r.kind === 'bot-wall' ? `${C.warn}bot-wall${C.off}` : `${C.bad}DEAD    ${C.off}`;
  console.log(`${tag} ${url} ${C.dim}${r.detail}${C.off}`);
  if (r.kind === 'dead') for (const f of found.get(url)) console.log(`         ${C.dim}cited in ${f}${C.off}`);
}

const okCount = results.length - dead - walled;
console.log(
  `\n${dead ? C.bad : C.ok}${okCount} open · ${walled} bot-walled (fine in a browser) · ${dead} dead${C.off}`,
);
process.exit(dead ? 1 : 0);
