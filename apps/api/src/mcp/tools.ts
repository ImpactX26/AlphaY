import { z } from 'zod';
import type { WebService } from '../web/web.service';
import type { FactsService } from '../profile/facts.service';
import type { StateService } from '../agent/state.service';
import { runChecks } from '../agent/checks';
import { convertIndianGrade } from '../knowledge/grades';
import { cefrGap, cefrIndex, parseCefr, WEEKS_PER_LEVEL } from '../knowledge/cefr';
import { chancenkartePoints, experienceMonths } from '../agent/specialists/route';
import { personalStrings } from '../agent/specialists/specialists.service';
import { netPay, monthlyBudget } from '../knowledge/money';
import { findCity } from '../knowledge/cities';

export interface ToolDeps {
  web: WebService;
  facts: FactsService;
  state: StateService;
}

export interface McpTool {
  name: string;
  title: string;
  description: string;
  input: z.ZodRawShape;
  run: (args: any, deps: ToolDeps) => Promise<unknown>;
}

/**
 * A tool call belongs to whatever run asked for it.
 *
 * The source guard only accepts a Web fact when the page was opened *in the same run*, so a
 * fetch_page that invented its own run id could never satisfy a save_fact from the caller's —
 * every citation would have been refused, correctly and uselessly. Clients that have a run pass it;
 * anything else gets its own.
 */
const ctx = (applicantId?: string, runId?: string) => ({ runId: runId || `mcp_${Date.now().toString(36)}`, applicantId: applicantId ?? null });

/**
 * The agent's tools, as MCP.
 *
 * These are the same functions the loop calls in-process; nothing here is a second implementation.
 * Exposing them over MCP means the reasoning and the capabilities are separable: the harness is one
 * client, and a consultant's own assistant can be another without reaching into our database.
 *
 * The guards travel with the tools, not with the caller. `fetch_page` logs its source, `save_fact`
 * refuses a web claim whose quote is not on a page opened in this run, and `search` rejects a query
 * carrying personal data — so an MCP client cannot get a looser agent than our own loop has.
 */
export const MCP_TOOLS: McpTool[] = [
  {
    name: 'fetch_page',
    title: 'Open a page',
    description: 'Fetches a URL, returns readable text, and records it as a source for this run so a fact may cite it.',
    input: { url: z.string().url(), applicantId: z.string().uuid().optional(), runId: z.string().optional() },
    run: async ({ url, applicantId, runId }, d) => {
      const page = await d.web.fetchPage(url, ctx(applicantId, runId));
      return page ? { url, title: page.title, text: page.text.slice(0, 12_000) } : { url, error: 'could not be opened' };
    },
  },
  {
    name: 'search',
    title: 'Search the web',
    description: 'Searches the web. Rejects any query containing personal data (a name, a passport number, a phone number).',
    input: { query: z.string().min(2), applicantId: z.string().uuid().optional(), runId: z.string().optional() },
    run: async ({ query, applicantId, runId }, d) => {
      // Load the applicant's own identifiers so the guard has something to compare against. An
      // MCP client does not know what counts as personal here, and should not have to.
      const personal = applicantId ? personalStrings(await d.state.load(applicantId)) : [];
      return { query, results: await d.web.search(query, ctx(applicantId, runId), personal) };
    },
  },
  {
    name: 'places_nearby',
    title: 'Places near a point',
    description: 'OpenStreetMap places near a coordinate: supermarkets, clinics, language schools, places of worship.',
    input: { lat: z.number(), lon: z.number(), filters: z.array(z.string()), radiusM: z.number().default(2000) },
    run: async ({ lat, lon, filters, radiusM }, d) => ({ places: await d.web.placesNearby(lat, lon, filters, radiusM, ctx()) }),
  },
  {
    name: 'job_search',
    title: 'Search German job openings',
    description: 'Searches the Bundesagentur für Arbeit job board.',
    input: { what: z.string(), where: z.string().optional() },
    run: async ({ what, where }, d) => ({ jobs: await d.web.jobSearch(what, where ?? '', ctx()) }),
  },
  {
    name: 'convert_grade',
    title: 'Convert an Indian grade to the German scale',
    description: 'Modified Bavarian formula. Returns the German grade (1.0 best to 4.0 pass) and the arithmetic behind it.',
    input: { grade: z.string(), scaleMax: z.number().optional(), passMin: z.number().optional() },
    run: async ({ grade, scaleMax, passMin }) => {
      const c = convertIndianGrade(grade, scaleMax, passMin);
      return c ? { input: grade, german: c.german, formula: c.formula } : { input: grade, error: 'could not be read as a grade' };
    },
  },
  {
    name: 'language_plan',
    title: 'How long to reach a German level',
    description: 'Levels still to pass, weeks of course and a finish date, from a current CEFR level to a target.',
    input: { from: z.string().nullable(), to: z.string() },
    run: async ({ from, to }) => {
      const have = parseCefr(from);
      const need = parseCefr(to);
      if (!need) return { error: `${to} is not a CEFR level` };
      const levels = cefrGap(have, need);
      const weeks = levels * WEEKS_PER_LEVEL;
      const finish = new Date(Date.now() + weeks * 7 * 86_400_000);
      return { from: have ?? 'none', to: need, levelsToPass: levels, weeks, weeksPerLevel: WEEKS_PER_LEVEL, finishesAbout: finish.toISOString().slice(0, 10) };
    },
  },
  {
    name: 'chancenkarte_points',
    title: 'Score the Opportunity Card',
    description: 'Points for the Chancenkarte, itemised. Six points are needed when the qualification is not fully recognised.',
    input: { applicantId: z.string().uuid() },
    run: async ({ applicantId }, d) => {
      const st = await d.state.load(applicantId);
      return chancenkartePoints(st);
    },
  },
  {
    name: 'readiness',
    title: 'Check an applicant against their route',
    description: 'Runs every required check and returns the checks, the gaps with fix-it plans, and the readiness meters.',
    input: { applicantId: z.string().uuid() },
    run: async ({ applicantId }, d) => {
      const st = await d.state.load(applicantId);
      const r = runChecks(st);
      return { checks: r.checks, readiness: r.readiness, language: r.language, gaps: r.gaps.map((g) => ({ title: g.title, what: g.what, howLong: g.howLong, cost: g.cost })) };
    },
  },
  {
    name: 'profile',
    title: 'Read an applicant profile',
    description: 'The facts on file with their tags (verified, said, web, ai), the truth map, and what is still unproven.',
    input: { applicantId: z.string().uuid() },
    run: async ({ applicantId }, d) => {
      const st = await d.state.load(applicantId);
      return {
        name: st.applicant.name,
        route: st.applicant.route,
        stage: st.applicant.stage,
        facts: st.facts.map((f) => ({ key: f.key, label: f.label, value: f.value, tag: f.tag, source: f.sourceKind })),
        truth: st.truth.rows,
        experienceMonths: experienceMonths(st),
      };
    },
  },
  {
    name: 'save_fact',
    title: 'Save a fact',
    description: 'Writes a fact. A web claim must carry the URL opened in this run and a quote that is really on that page, or it is refused.',
    input: {
      applicantId: z.string().uuid(),
      key: z.string(),
      label: z.string(),
      value: z.string(),
      tag: z.enum(['verified', 'said', 'web', 'ai']),
      sourceUrl: z.string().url().optional(),
      quote: z.string().optional(),
      runId: z.string().optional(),
    },
    run: async (a, d) => {
      const saved = await d.facts.save(
        a.applicantId,
        { key: a.key, label: a.label, value: a.value, tag: a.tag, sourceKind: a.tag === 'web' ? 'web' : 'agent', sourceUrl: a.sourceUrl ?? null, quote: a.quote ?? null },
        { runId: a.runId ?? ctx().runId },
      );
      return saved ? { saved: true, id: saved.id } : { saved: false, reason: 'refused by the source guard: no page with that quote was opened in this run' };
    },
  },
  {
    name: 'cost_of_living',
    title: 'What a month costs in a German city',
    description: 'Rent, insurance, transport and what is left, for a German city, optionally against a gross salary.',
    input: { city: z.string(), grossMonthly: z.number().optional(), as: z.enum(['student', 'worker']).default('worker') },
    run: async ({ city, grossMonthly, as }) => {
      const c = findCity(city);
      if (!c) return { error: `no data for ${city}` };
      const budget = monthlyBudget(c, as ?? 'worker');
      return grossMonthly ? { city: c.name, budget, net: netPay(grossMonthly) } : { city: c.name, budget };
    },
  },
];

export const TOOL_NAMES = MCP_TOOLS.map((t) => t.name);
export const cefrRank = cefrIndex;
