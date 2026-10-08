import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { MatrixBlock, MatrixStatus, Tag } from '@educaro/shared';
import { db, schema } from '../db/db';
import { LlmService } from '../llm/llm.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TraceService } from '../trace/trace.service';
import { WebService } from '../web/web.service';
import { cefrIndex, parseCefr } from '../knowledge/cefr';
import { convertIndianGrade } from '../knowledge/grades';
import { squashQuote } from '../knowledge/normalize';
import { daysUntil } from '../knowledge/normalize';
import { AgentEventsService } from './events.service';
import { StateService, bestFact, factData, type ApplicantState } from './state.service';
import { germanLevels } from './checks';

const Quoted = <T extends z.ZodTypeAny>(v: T) => z.object({ value: v, quote: z.string() }).nullable();
export const Requirements = z.object({
  title: z.string(),
  university: z.string().nullable(),
  city: z.string().nullable(),
  teachingLanguage: z.enum(['english', 'german', 'both']).nullable(),
  degree: Quoted(z.string()),
  minGrade: Quoted(z.number()),
  english: z.object({ ielts: z.number().nullable(), toefl: z.number().nullable(), quote: z.string() }).nullable(),
  german: Quoted(z.string()),
  gre: z.object({ required: z.boolean(), quote: z.string() }).nullable(),
  applicationRoute: Quoted(z.string()),
  deadline: z.object({ date: z.string().nullable(), text: z.string(), quote: z.string() }).nullable(),
  fees: Quoted(z.string()),
  keywords: z.array(z.string()),
});
export type Requirements = z.infer<typeof Requirements>;

const SYSTEM = `You read a university programme page for an Indian applicant. Extract the admission requirements.
Every field that you fill must carry "quote": a short verbatim phrase (4-15 words) copied exactly from the page text.
Use null when the page does not say it. minGrade on the German scale (1.0 best .. 4.0) only if the page states one.
deadline.date as YYYY-MM-DD for the next winter semester intake for non-EU applicants, if stated.
keywords: 5 to 10 of the programme's own subject words (e.g. "machine learning", "statistics").`;

type MatrixRow = MatrixBlock['rows'][number];

/** Stage 6: shortlist one, read its official page, compare in code, plan every gap. */
@Injectable()
export class ShortlistService {
  private readonly log = new Logger('Shortlist');

  constructor(
    private readonly web: WebService,
    private readonly llm: LlmService,
    private readonly state: StateService,
    private readonly events: AgentEventsService,
    private readonly trace: TraceService,
    private readonly rt: RealtimeGateway,
  ) {}

  async add(applicantId: string, body: { programmeId?: string; openingId?: string; url?: string }) {
    let values: typeof schema.shortlist.$inferInsert;
    if (body.programmeId) {
      const p = await db.query.programmes.findFirst({ where: eq(schema.programmes.id, body.programmeId) });
      if (!p) throw new NotFoundException('Programme not found');
      values = { applicantId, kind: 'programme', refId: p.id, title: p.title, subtitle: `${p.university} · ${p.city}`, url: p.url };
    } else if (body.openingId) {
      const o = await db.query.openings.findFirst({ where: eq(schema.openings.id, body.openingId) });
      if (!o) throw new NotFoundException('Opening not found');
      values = { applicantId, kind: 'opening', refId: o.id, title: o.title, subtitle: `${o.employer} · ${o.city}`, url: '' };
    } else if (body.url) {
      const known = await db.query.programmes.findFirst({ where: eq(schema.programmes.url, body.url) });
      values = known
        ? { applicantId, kind: 'programme', refId: known.id, title: known.title, subtitle: `${known.university} · ${known.city}`, url: known.url }
        : { applicantId, kind: 'programme', title: 'Reading the page…', subtitle: new URL(body.url).hostname, url: body.url };
    } else throw new NotFoundException('Nothing to shortlist');
    const dup = (await db.query.shortlist.findMany({ where: eq(schema.shortlist.applicantId, applicantId) })).find((s) => (values.refId && s.refId === values.refId) || (values.url && s.url === values.url));
    if (dup) return dup;
    const [row] = await db.insert(schema.shortlist).values(values).returning();
    this.rt.toBoth(applicantId, { type: 'refresh', applicantId, what: ['shortlist'] });
    await this.events.wake(applicantId, { type: 'shortlist', detail: { shortlistId: row.id } });
    return row;
  }

  async remove(id: string) {
    const [row] = await db.delete(schema.shortlist).where(eq(schema.shortlist.id, id)).returning();
    if (row) this.rt.toBoth(row.applicantId, { type: 'refresh', applicantId: row.applicantId, what: ['shortlist'] });
    return { ok: true };
  }

  /** Called by the loop for every shortlist row still in 'checking'. */
  async buildPending(applicantId: string, runId: string) {
    const rows = await db.query.shortlist.findMany({ where: eq(schema.shortlist.applicantId, applicantId) });
    for (const r of rows.filter((x) => x.status === 'checking' || !x.matrix)) await this.build(r.id, runId);
  }

  async build(shortlistId: string, runId: string) {
    const row = await db.query.shortlist.findFirst({ where: eq(schema.shortlist.id, shortlistId) });
    if (!row) return;
    const st = await this.state.load(row.applicantId);
    const ctx = { runId, applicantId: row.applicantId };
    let matrix: Pick<MatrixBlock, 'rows' | 'exams' | 'deadline'>;
    let requirements: Record<string, unknown> = {};
    let title = row.title;
    let subtitle = row.subtitle;

    if (row.kind === 'opening' && row.refId) {
      const o = await db.query.openings.findFirst({ where: eq(schema.openings.id, row.refId) });
      matrix = openingMatrix(st, o!);
      requirements = { keywords: o?.keywords ?? [] };
    } else {
      const prog = row.refId ? await db.query.programmes.findFirst({ where: eq(schema.programmes.id, row.refId) }) : null;
      // The university's own page is the source. If it cannot be reached and nothing is cached, a
      // seeded programme falls back to the stand-in we serve, so a dead network degrades the demo
      // rather than ending it — and the matrix still says which URL every quote came from.
      let page = row.url ? await this.web.fetchPage(row.url, ctx) : null;
      const fallbackUrl = (prog?.data as any)?.fallbackUrl as string | undefined;
      if (!page && fallbackUrl) {
        this.log.warn(`${row.url} unreachable; reading the stand-in at ${fallbackUrl}`);
        page = await this.web.fetchPage(fallbackUrl, ctx);
      }
      let req: Requirements | null = (prog?.data as any)?.requirements ?? null;
      if (!req && page) {
        req = await this.llm.json({
          task: 'read_requirements',
          tier: 'cheap',
          system: SYSTEM,
          user: `URL: ${row.url}\n\nPAGE TEXT:\n${relevant(page.text).slice(0, 9000)}`,
          schema: Requirements,
          applicantId: row.applicantId,
          runId,
          maxTokens: 2500,
        });
      }
      if (!req) req = emptyReq(row.title);
      // Each requirement counts as Web-sourced only if its quote is on the page we opened in this run.
      const onPage = (q?: string | null) => !!(q && page && squash(page.text).includes(squash(q)));
      matrix = programmeMatrix(st, req, page?.url ?? row.url, onPage);
      requirements = req as unknown as Record<string, unknown>;
      if (title === 'Reading the page…') {
        title = req.title;
        subtitle = [req.university, req.city].filter(Boolean).join(' · ') || subtitle;
      }
      const verifiedQuotes = [req.degree, req.minGrade, req.english, req.applicationRoute, req.deadline].filter((x: any) => x && onPage(x.quote)).length;
      await this.trace.record('tool', 'requirement_matrix', { shortlist: title, rows: matrix.rows.length, quotesOnPage: verifiedQuotes }, ctx);
    }
    const gapCount = matrix.rows.filter((r) => ['missing', 'pending', 'start_now'].includes(r.status)).length;
    await db
      .update(schema.shortlist)
      .set({ matrix: matrix as unknown as Record<string, unknown>, requirements, gapCount, status: gapCount ? 'gaps' : 'ready', title, subtitle })
      .where(eq(schema.shortlist.id, shortlistId));
    this.rt.toBoth(row.applicantId, { type: 'refresh', applicantId: row.applicantId, what: ['shortlist'] });
  }
}

const squash = squashQuote;

function relevant(text: string): string {
  const lines = text.split('\n');
  const keep = lines.filter((l) => /admission|requirement|ielts|toefl|english|german|grade|degree|bachelor|deadline|apply|application|uni-assist|fee|tuition|semester|gre|aps|language/i.test(l));
  return (keep.length > 10 ? keep : lines).join('\n');
}

function emptyReq(title: string): Requirements {
  return { title, university: null, city: null, teachingLanguage: null, degree: null, minGrade: null, english: null, german: null, gre: null, applicationRoute: null, deadline: null, fees: null, keywords: [] };
}

function programmeMatrix(st: ApplicantState, req: Requirements, url: string, onPage: (q?: string | null) => boolean): Pick<MatrixBlock, 'rows' | 'exams' | 'deadline'> {
  const rows: MatrixRow[] = [];
  const src = (q?: string | null) => (onPage(q) ? url : null);
  const qual = bestFact(st, 'education.highest');
  const g = factData(st, 'education.grade');
  const rawGrade = String(g.raw ?? bestFact(st, 'education.grade')?.value ?? '');
  const conv = convertIndianGrade(rawGrade, g.scaleMax, g.passMin);
  rows.push({
    requirement: 'Bachelor',
    needs: req.degree?.value ?? 'A relevant bachelor’s degree',
    has: qual ? `${qual.value}${qual.sourceKind === 'document' ? ', degree certificate' : ' (not proven yet)'}` : 'Not found yet',
    status: qual?.sourceKind === 'document' ? 'meets' : qual ? 'pending' : 'missing',
    tag: qual?.sourceKind === 'document' ? 'verified' : 'said',
    sourceUrl: src(req.degree?.quote),
  });
  rows.push({
    requirement: 'Grade',
    needs: req.minGrade ? `German ${req.minGrade.value.toFixed(1)} or better` : 'No minimum stated',
    has: conv ? `${conv.german.toFixed(1)}, from ${rawGrade}` : 'Upload the final transcript',
    status: !conv ? 'pending' : !req.minGrade || conv.german <= req.minGrade.value ? 'meets' : 'missing',
    tag: 'ai',
    sourceUrl: src(req.minGrade?.quote),
  });
  if (req.english || req.teachingLanguage !== 'german') {
    const eng = st.facts.filter((f) => f.key === 'language.english');
    const proven = eng.find((f) => f.sourceKind === 'document');
    const claimed = eng.find((f) => f.sourceKind !== 'document');
    const band = Number(String((proven ?? claimed)?.value ?? '').match(/(\d(?:\.\d)?)/)?.[1] ?? 0);
    const need = req.english?.ielts ?? 6.5;
    rows.push({
      requirement: 'English',
      needs: `IELTS ${need}${req.english?.toefl ? ` or TOEFL iBT ${req.english.toefl}` : ''}`,
      has: proven ? `${proven.value}, report on file` : claimed ? `${claimed.value} claimed, no report` : 'No test yet',
      status: proven ? (band >= need ? 'meets' : 'missing') : claimed ? 'pending' : 'missing',
      tag: proven ? 'verified' : claimed ? 'said' : 'ai',
      sourceUrl: src(req.english?.quote),
    });
  }
  if (req.german) {
    const { proven } = germanLevels(st);
    const need = parseCefr(req.german.value);
    rows.push({
      requirement: 'German',
      needs: req.german.value,
      has: proven ?? 'None proven',
      status: need && cefrIndex(proven) >= cefrIndex(need) ? 'meets' : 'missing',
      tag: proven ? 'verified' : 'ai',
      sourceUrl: src(req.german.quote),
    });
  }
  const aps = st.files.some((f) => f.kind === 'aps_certificate' && f.status === 'done');
  rows.push({ requirement: 'APS certificate', needs: 'Required for Indian degrees', has: aps ? 'On file' : 'Not started', status: aps ? 'meets' : 'start_now', tag: aps ? 'verified' : 'web', sourceUrl: 'https://www.aps-india.de/' });
  if (req.gre?.required) rows.push({ requirement: 'GRE', needs: 'Required', has: 'Not found', status: 'missing', tag: 'web', sourceUrl: src(req.gre.quote) });
  rows.push({
    requirement: 'Application route',
    needs: req.applicationRoute?.value ?? 'See the programme page',
    has: 'Pack can be prepared',
    status: 'info',
    tag: onPage(req.applicationRoute?.quote) ? 'web' : 'ai',
    sourceUrl: src(req.applicationRoute?.quote),
  });
  const days = daysUntil(req.deadline?.date ?? null);
  rows.push({
    requirement: 'Deadline',
    needs: req.deadline?.text ?? 'Winter intake',
    has: days != null ? `${days} days left, counted down on your screen` : 'Counted down on your screen',
    status: days != null && days < 30 ? 'start_now' : 'info',
    tag: onPage(req.deadline?.quote) ? 'web' : 'ai',
    sourceUrl: src(req.deadline?.quote),
  });
  if (req.fees) rows.push({ requirement: 'Fees', needs: req.fees.value, has: 'In your budget', status: 'info', tag: onPage(req.fees.quote) ? 'web' : 'ai', sourceUrl: src(req.fees.quote) });

  const eng = st.facts.filter((f) => f.key === 'language.english');
  const exams: MatrixBlock['exams'] = [
    { name: 'IELTS', status: eng.some((f) => f.sourceKind === 'document') ? 'done' : eng.length ? 'pending' : 'not_started' },
    { name: 'APS', status: aps ? 'done' : 'not_started' },
    { name: 'GRE', status: req.gre?.required ? 'not_started' : 'not_needed' },
    { name: 'TestDaF', status: req.teachingLanguage === 'german' ? 'not_started' : 'not_needed' },
  ];
  return { rows, exams, deadline: { label: req.deadline?.text ?? 'Winter intake', date: req.deadline?.date ?? null, daysLeft: days } };
}

function openingMatrix(st: ApplicantState, o: typeof schema.openings.$inferSelect): Pick<MatrixBlock, 'rows' | 'exams' | 'deadline'> {
  const { proven, claimed } = germanLevels(st);
  const need = parseCefr(o.germanLevel);
  const have = proven ?? claimed;
  const qual = bestFact(st, 'education.highest');
  const rows: MatrixRow[] = [
    {
      requirement: 'Qualification',
      needs: o.route === 'nursing' ? 'Nursing degree or diploma' : o.route === 'ausbildung' ? 'Class 12' : 'Completed qualification',
      has: qual?.value ?? 'Not found yet',
      status: qual?.sourceKind === 'document' ? 'meets' : qual ? 'pending' : 'missing',
      tag: (qual?.sourceKind === 'document' ? 'verified' : 'said') as Tag,
      sourceUrl: null,
    },
    {
      requirement: 'German',
      needs: o.germanLevel,
      has: have ? `${have}${proven ? '' : ' claimed'}` : 'None yet',
      status: (need && cefrIndex(proven) >= cefrIndex(need) ? 'meets' : have ? 'pending' : 'missing') as MatrixStatus,
      tag: (proven ? 'verified' : 'said') as Tag,
      sourceUrl: null,
    },
  ];
  if (o.needsRecognition) {
    const rec = st.facts.find((f) => f.key === 'recognition.status');
    rows.push({ requirement: 'Recognition', needs: 'Anerkennung started', has: rec?.value ?? 'Not started', status: rec ? 'meets' : 'start_now', tag: 'ai', sourceUrl: 'https://www.educaro.de/anerkennung/' });
  }
  rows.push({ requirement: 'Start date', needs: o.startDate, has: 'Fits your timeline', status: 'info', tag: 'ai', sourceUrl: null });
  rows.push({ requirement: 'Location', needs: o.city, has: '', status: 'info', tag: 'ai', sourceUrl: null });
  return {
    rows,
    exams: [{ name: `German ${o.germanLevel}`, status: need && cefrIndex(proven) >= cefrIndex(need) ? 'done' : have ? 'pending' : 'not_started' }],
    deadline: { label: `Start ${o.startDate}`, date: null, daysLeft: null },
  };
}
