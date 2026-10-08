import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type {
  BatchPlanDTO,
  BriefDTO,
  BroadcastDTO,
  CopilotResultDTO,
  MailTrackerDetailDTO,
  MailTrackerItemDTO,
  MatchDTO,
  OpeningDTO,
  OpeningInput,
  PipelineCardDTO,
  Route,
  StaffQueueItemDTO,
  StatsDTO,
} from '@educaro/shared';
import { PIPELINE_LABEL, ROUTE_LABEL } from '@educaro/shared';
import { db, schema } from '../db/db';
import { config } from '../config';
import { LlmService } from '../llm/llm.service';
import { TraceService } from '../trace/trace.service';
import { StateService } from '../agent/state.service';
import { germanLevels, runChecks } from '../agent/checks';
import { ActionsService } from '../agent/actions.service';
import { MailService } from '../outbound/mail.service';
import { ChatService } from '../profile/chat.service';
import { cefrGap, cefrIndex, parseCefr, WEEKS_PER_LEVEL } from '../knowledge/cefr';
import { monthLabel, monthsBetween, slug, midSentence } from '../knowledge/normalize';
import { SPECIALIST_LABEL, type SpecialistName } from '../knowledge/routes';

type ApplicantRow = typeof schema.applicants.$inferSelect;
type OpeningRow = typeof schema.openings.$inferSelect;
type MatchRow = typeof schema.matches.$inferSelect;

export const toOpeningDTO = (o: OpeningRow): OpeningDTO => ({
  id: o.id,
  employer: o.employer,
  employerEmail: o.employerEmail,
  title: o.title,
  city: o.city,
  route: o.route as Route,
  germanLevel: o.germanLevel,
  startDate: o.startDate,
  needsRecognition: o.needsRecognition,
  description: o.description,
  keywords: o.keywords,
  status: o.status,
  createdAt: o.createdAt.toISOString(),
});

const Copilot = z.object({
  interpretation: z.string(),
  route: z.string().nullable(),
  stage: z.string().nullable(),
  gapKey: z.string().nullable(),
  germanBelow: z.string().nullable(),
  conflictsOnly: z.boolean(),
  waitingOnUs: z.boolean(),
});

const Profile = z.object({
  headline: z.string(),
  sections: z.array(z.object({ title: z.string(), lines: z.array(z.string()) })),
});

/** Everything behind /api/staff: the command centre. Filters and scores are code; the model only writes words. */
@Injectable()
export class StaffService {
  constructor(
    private readonly state: StateService,
    private readonly llm: LlmService,
    private readonly mail: MailService,
    private readonly chat: ChatService,
    private readonly actions: ActionsService,
    private readonly trace: TraceService,
  ) {}

  // ---------------- pipeline ----------------

  async pipeline(): Promise<PipelineCardDTO[]> {
    const rows = await db.select().from(schema.applicants).orderBy(desc(schema.applicants.updatedAt));
    return Promise.all(rows.map((a) => this.card(a)));
  }

  async card(a: ApplicantRow): Promise<PipelineCardDTO> {
    const st = await this.state.load(a.id);
    const report = runChecks(st);
    return {
      applicantId: a.id,
      name: a.name,
      subtitle: a.subtitle,
      route: (a.route as Route) ?? null,
      stage: a.stage as PipelineCardDTO['stage'],
      stageReason: a.stageReason,
      readiness: report.readiness.overall,
      openGaps: st.gaps.filter((g) => g.status !== 'done').length,
      openQuestions: st.questions.filter((q) => q.status === 'open').length,
      pendingApprovals: st.approvals.filter((p) => p.status === 'pending').length,
      conflicts: st.truth.rows.filter((r) => r.status === 'conflict').length,
      updatedAt: a.updatedAt.toISOString(),
    };
  }

  async setStage(applicantId: string, stage: PipelineCardDTO['stage'], reason: string) {
    const [a] = await db
      .update(schema.applicants)
      .set({ stage, stageReason: reason || `Moved by staff to ${PIPELINE_LABEL[stage]}`, updatedAt: new Date() })
      .where(eq(schema.applicants.id, applicantId))
      .returning();
    if (!a) throw new NotFoundException();
    await this.trace.record('move', 'staff_moved_card', { stage, reason }, { applicantId });
    return this.card(a);
  }

  async approveSubmission(applicantId: string) {
    const [a] = await db
      .update(schema.applicants)
      .set({ approvedByStaffAt: new Date(), stage: 'staff_review', stageReason: 'Approved by an Educaro consultant', updatedAt: new Date() })
      .where(eq(schema.applicants.id, applicantId))
      .returning();
    if (!a) throw new NotFoundException();
    await db
      .update(schema.approvals)
      .set({ status: 'approved', staffApprovedAt: new Date() })
      .where(and(eq(schema.approvals.applicantId, applicantId), eq(schema.approvals.kind, 'submit'), eq(schema.approvals.status, 'pending')));
    await this.chat.agentSays(applicantId, 'An Educaro consultant has reviewed your file and approved it. You are in the queue for your route — I will keep working on the plan.');
    await this.trace.record('approval', 'staff_approved_submission', {}, { applicantId });
    return a;
  }

  async settings(applicantId: string, staffSecondKey: boolean) {
    const [a] = await db.update(schema.applicants).set({ staffSecondKey, updatedAt: new Date() }).where(eq(schema.applicants.id, applicantId)).returning();
    if (!a) throw new NotFoundException();
    return a;
  }

  // ---------------- consultant brief ----------------

  async brief(applicantId: string): Promise<BriefDTO> {
    const st = await this.state.load(applicantId);
    const report = runChecks(st);
    const lang = germanLevels(st);
    const booked = st.calendar.find((c) => c.title.includes('Educaro consultant'));
    const tried = Object.keys(st.outputs)
      .map((name) => SPECIALIST_LABEL[name as SpecialistName] ?? name)
      .slice(0, 8);
    const conflicts = st.truth.rows.filter((r) => r.status === 'conflict');
    const open = st.questions.filter((q) => q.status === 'open');
    return {
      applicantId,
      who: [st.applicant.name, st.applicant.subtitle, st.applicant.homeCity].filter(Boolean).join(' · '),
      route: st.applicant.route ? `${ROUTE_LABEL[st.applicant.route as Route]} — ${st.applicant.routeReasons[0] ?? 'chosen by the agent'}` : 'Not decided yet',
      openGaps: report.gaps.slice(0, 6).map((g) => `${g.title}: ${g.what} (${g.howLong}, ${g.cost})`),
      agentTried: [
        ...tried.map((t) => `Ran ${t}`),
        `German: proven ${lang.proven ?? 'none'}, claimed ${lang.claimed ?? 'none'}, needed ${report.language.need ?? '—'}`,
        `${st.files.length} documents read, ${st.facts.length} facts on file`,
      ],
      questionsToAsk: [
        ...conflicts.map((c) => `${c.label}: "${c.document ?? c.cv ?? ''}" vs "${c.video ?? c.cv ?? ''}" — which version is right?`),
        ...open.map((q) => q.prompt),
      ].slice(0, 5),
      bookedFor: booked?.startsAt.toISOString() ?? null,
    };
  }

  async bookConsultant(applicantId: string, _when?: string): Promise<BriefDTO> {
    await this.actions.bookConsultant(applicantId, 'Booked from the staff command centre.');
    return this.brief(applicantId);
  }

  // ---------------- approval queue ----------------

  async queue(): Promise<StaffQueueItemDTO[]> {
    const applicants = await db.select().from(schema.applicants);
    const names = new Map(applicants.map((a) => [a.id, a.name]));
    const items: StaffQueueItemDTO[] = [];

    const pending = await db.select().from(schema.approvals).where(eq(schema.approvals.status, 'pending')).orderBy(desc(schema.approvals.createdAt));
    for (const p of pending) {
      const payload = p.payload as any;
      items.push({
        id: p.id,
        kind: p.kind === 'submit' ? 'submission' : 'approval',
        applicantId: p.applicantId,
        applicantName: names.get(p.applicantId) ?? 'Applicant',
        title: p.title,
        detail: p.needsStaff && !p.staffApprovedAt ? 'Waiting for your second key' : payload?.subject ? `To ${payload.to ?? 'recipient'} · ${payload.subject}` : 'Waiting for the applicant',
        refId: p.id,
        createdAt: p.createdAt.toISOString(),
      });
    }

    const unclear = await db.select().from(schema.files).where(eq(schema.files.status, 'unclear'));
    for (const f of unclear) {
      items.push({
        id: `file:${f.id}`,
        kind: 'low_confidence_read',
        applicantId: f.applicantId,
        applicantName: names.get(f.applicantId) ?? 'Applicant',
        title: `Could not read "${f.originalName}"`,
        detail: `Confidence ${Math.round((f.confidence ?? 0) * 100)}%. A human should look at this file.`,
        refId: f.id,
        createdAt: f.createdAt.toISOString(),
      });
    }

    for (const a of applicants) {
      const st = await this.state.load(a.id);
      for (const row of st.truth.rows.filter((r) => r.status === 'conflict')) {
        items.push({
          id: `conflict:${a.id}:${slug(row.label)}`,
          kind: 'unproved_conflict',
          applicantId: a.id,
          applicantName: a.name,
          title: `${row.label}: two versions do not agree`,
          detail: [row.document && `document: ${row.document}`, row.cv && `CV: ${row.cv}`, row.video && `video: ${row.video}`].filter(Boolean).join('  ·  ') || row.note,
          refId: null,
          createdAt: a.updatedAt.toISOString(),
        });
      }
      if (a.submittedAt && !a.approvedByStaffAt) {
        items.push({
          id: `submit:${a.id}`,
          kind: 'submission',
          applicantId: a.id,
          applicantName: a.name,
          title: `${a.name} submitted their file to Educaro`,
          detail: a.route ? ROUTE_LABEL[a.route as Route] : 'Route not decided',
          refId: null,
          createdAt: a.submittedAt.toISOString(),
        });
      }
    }
    return items.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  }

  // ---------------- copilot ----------------

  async copilot(query: string): Promise<CopilotResultDTO> {
    const spec =
      (await this.llm.json({
        task: 'staff_copilot',
        tier: 'cheap',
        system:
          'Turn a staff question about a caseload of Indian applicants moving to Germany into a filter. route is one of nursing, ausbildung, study, skilled_job or null. stage is one of new_story, reading, truth_check, route_set, plan, staff_review, applying, matched, germany or null. gapKey is a short keyword for the gap they are missing (german, aps, ielts, money, recognition, passport) or null. germanBelow is a CEFR level like B1 or null. interpretation: one sentence saying what you filtered on.',
        user: query,
        schema: Copilot,
        maxTokens: 350,
      })) ?? this.copilotRules(query);

    const applicants = await db.select().from(schema.applicants);
    const columns = ['Name', 'Route', 'Stage', 'German', 'Readiness', 'Blocked by'];
    const rows: CopilotResultDTO['rows'] = [];
    const ids: string[] = [];

    for (const a of applicants) {
      if (spec.route && a.route !== spec.route) continue;
      if (spec.stage && a.stage !== spec.stage) continue;
      const st = await this.state.load(a.id);
      const report = runChecks(st);
      const lang = germanLevels(st);
      const have = lang.proven ?? lang.claimed ?? null;
      if (spec.germanBelow && cefrIndex(have) >= cefrIndex(parseCefr(spec.germanBelow))) continue;
      if (spec.gapKey && !report.gaps.some((g) => g.key.includes(spec.gapKey!) || g.title.toLowerCase().includes(spec.gapKey!.toLowerCase()))) continue;
      if (spec.conflictsOnly && !st.truth.rows.some((r) => r.status === 'conflict')) continue;
      if (spec.waitingOnUs && !st.approvals.some((p) => p.status === 'pending' && p.needsStaff)) continue;
      ids.push(a.id);
      rows.push({
        Name: a.name,
        Route: a.route ? ROUTE_LABEL[a.route as Route] : '—',
        Stage: PIPELINE_LABEL[a.stage as PipelineCardDTO['stage']] ?? a.stage,
        German: `${have ?? 'none'}${lang.proven ? '' : ' (claimed)'}`,
        Readiness: report.readiness.overall,
        'Blocked by': report.gaps[0]?.title ?? '—',
      });
    }
    rows.sort((x, y) => Number(y.Readiness) - Number(x.Readiness));
    await this.trace.record('tool', 'staff_copilot', { query, matched: rows.length });
    return { query, interpretation: spec.interpretation, columns, rows, applicantIds: ids };
  }

  private copilotRules(q: string): z.infer<typeof Copilot> {
    const l = q.toLowerCase();
    const route = (['nursing', 'ausbildung', 'study', 'skilled_job'] as const).find((r) => l.includes(r.replace('_', ' ')) || l.includes(r)) ?? (l.includes('master') ? 'study' : l.includes('nurse') ? 'nursing' : null);
    const germanBelow = /\b(a1|a2|b1|b2|c1)\b/.exec(l)?.[1]?.toUpperCase() ?? null;
    const gapKey = ['german', 'aps', 'ielts', 'money', 'recognition', 'passport', 'blocked'].find((k) => l.includes(k)) ?? null;
    return {
      interpretation: `Filtered on ${[route && `route ${route}`, germanBelow && `German below ${germanBelow}`, gapKey && `missing ${gapKey}`].filter(Boolean).join(', ') || 'everyone'}.`,
      route,
      stage: null,
      gapKey: germanBelow ? null : gapKey,
      germanBelow,
      conflictsOnly: l.includes('conflict') || l.includes('mismatch'),
      waitingOnUs: l.includes('waiting') || l.includes('stuck') || l.includes('blocked on us'),
    };
  }

  // ---------------- openings and matching ----------------

  async openings(): Promise<OpeningDTO[]> {
    const rows = await db.select().from(schema.openings).orderBy(desc(schema.openings.createdAt));
    return rows.map(toOpeningDTO);
  }

  async createOpening(input: OpeningInput): Promise<OpeningDTO> {
    const keywords = Array.from(
      new Set(
        `${input.title} ${input.description}`
          .toLowerCase()
          .split(/[^a-zäöüß]+/)
          .filter((w) => w.length > 4),
      ),
    ).slice(0, 25);
    const [o] = await db.insert(schema.openings).values({ ...input, keywords }).returning();
    return toOpeningDTO(o);
  }

  private matchDTO(m: MatchRow, name: string): MatchDTO {
    return {
      id: m.id,
      openingId: m.openingId,
      applicantId: m.applicantId,
      displayName: m.consent ? name : `Candidate ${name.slice(0, 1).toUpperCase()}.`,
      score: Math.round(m.score),
      reasons: m.reasons,
      consent: m.consent,
      status: m.status,
      germanProfile: (m.germanProfile as MatchDTO['germanProfile']) ?? null,
    };
  }

  /** Hard filter in code first (route, recognition, start date), then a score with written reasons. */
  async match(openingId: string): Promise<MatchDTO[]> {
    const o = await db.query.openings.findFirst({ where: eq(schema.openings.id, openingId) });
    if (!o) throw new NotFoundException();
    const need = parseCefr(o.germanLevel);
    const start = new Date(o.startDate);
    const applicants = await db.select().from(schema.applicants);
    const scored: { applicantId: string; score: number; reasons: string[] }[] = [];

    for (const a of applicants) {
      if (a.route && a.route !== o.route) continue;
      const st = await this.state.load(a.id);
      const report = runChecks(st);
      const lang = germanLevels(st);
      const have = lang.proven ?? lang.claimed ?? null;
      const reasons: string[] = [];
      let score = 40;

      const gap = need ? cefrGap(have, need) : 0;
      const now = new Date();
      const monthsToStart = Math.max(0, monthsBetween({ y: now.getFullYear(), m: now.getMonth() + 1 }, { y: start.getFullYear(), m: start.getMonth() + 1 }));
      if (gap > 0 && gap * (WEEKS_PER_LEVEL / 4.33) > monthsToStart + 2) continue; // cannot reach the level in time
      if (gap === 0) {
        score += 25;
        reasons.push(`German ${have ?? '—'} already meets the required ${o.germanLevel}.`);
      } else {
        score += Math.max(0, 20 - gap * 8);
        reasons.push(`German ${have ?? 'none'} today, ${gap} level${gap > 1 ? 's' : ''} below ${o.germanLevel}; about ${gap * 3} months of course, and the job starts in ${monthsToStart} months.`);
      }
      if (!lang.proven && have) reasons.push('The German level is claimed, not yet proven by a certificate.');

      if (o.needsRecognition) {
        const rec = st.facts.find((f) => f.key.startsWith('registration.') || f.key === 'recognition.status');
        if (rec) {
          score += 10;
          reasons.push(`Recognition path started: ${rec.value}.`);
        } else reasons.push('Anerkennung not started yet — Educaro would file it.');
      }
      if (a.targetCity && a.targetCity.toLowerCase() === o.city.toLowerCase()) {
        score += 10;
        reasons.push(`Already aiming for ${o.city}.`);
      }
      const exp = st.facts.filter((f) => f.key.startsWith('experience.'));
      if (exp.length) {
        score += Math.min(15, exp.length * 5);
        reasons.push(`${exp.length} work entr${exp.length > 1 ? 'ies' : 'y'} on file, latest: ${exp[exp.length - 1].value}.`);
      }
      score += Math.round(report.readiness.overall / 10);
      reasons.push(`Readiness ${report.readiness.overall}%, ${report.gaps.length} open gap${report.gaps.length === 1 ? '' : 's'}.`);
      scored.push({ applicantId: a.id, score: Math.min(99, score), reasons: reasons.slice(0, 4) });
    }

    scored.sort((x, y) => y.score - x.score);
    await db.delete(schema.matches).where(and(eq(schema.matches.openingId, openingId), eq(schema.matches.status, 'ranked')));
    const names = new Map(applicants.map((a) => [a.id, a.name]));
    const out: MatchDTO[] = [];
    for (const s of scored.slice(0, 10)) {
      const [m] = await db.insert(schema.matches).values({ openingId, applicantId: s.applicantId, score: s.score, reasons: s.reasons }).returning();
      out.push(this.matchDTO(m, names.get(s.applicantId) ?? 'Applicant'));
    }
    await this.trace.record('tool', 'employer_match', { openingId, candidates: out.length });
    return out;
  }

  async matches(openingId: string): Promise<MatchDTO[]> {
    const rows = await db.select().from(schema.matches).where(eq(schema.matches.openingId, openingId)).orderBy(desc(schema.matches.score));
    if (!rows.length) return [];
    const applicants = await db.select().from(schema.applicants).where(inArray(schema.applicants.id, rows.map((r) => r.applicantId)));
    const names = new Map(applicants.map((a) => [a.id, a.name]));
    return rows.map((m) => this.matchDTO(m, names.get(m.applicantId) ?? 'Applicant'));
  }

  /** A one-page German profile, anonymised until the applicant consents. Facts only, no invention. */
  async profile(matchId: string): Promise<MatchDTO> {
    const m = await db.query.matches.findFirst({ where: eq(schema.matches.id, matchId) });
    if (!m) throw new NotFoundException();
    const o = await db.query.openings.findFirst({ where: eq(schema.openings.id, m.openingId) });
    const st = await this.state.load(m.applicantId);
    const lang = germanLevels(st);
    const usable = st.facts.filter((f) => (f.tag === 'verified' || f.tag === 'said') && !f.key.startsWith('contact.') && f.key !== 'identity.passport');
    const lines = usable.map((f) => `${f.label}: ${f.value}`);
    const anon = m.consent ? st.applicant.name : `Kandidat:in ${st.applicant.name.slice(0, 1).toUpperCase()}.`;

    const profile =
      (await this.llm.json({
        task: 'employer_profile_de',
        tier: 'cheap',
        system:
          'Schreibe ein einseitiges Kandidatenprofil auf Deutsch für einen deutschen Arbeitgeber. Nutze ausschließlich die gelieferten Fakten, erfinde nichts. Keine Namen, keine Adressen, keine Passnummern. Sektionen: Qualifikation, Berufserfahrung, Sprache, Verfügbarkeit. headline: eine Zeile.',
        user: `KANDIDAT: ${anon}\nSTELLE: ${o?.title ?? ''} bei ${o?.employer ?? ''} in ${o?.city ?? ''}, Start ${o?.startDate ?? ''}, Sprachniveau ${o?.germanLevel ?? ''}\nFAKTEN:\n${lines.join('\n')}\nDEUTSCH: nachgewiesen ${lang.proven ?? 'keins'}, angegeben ${lang.claimed ?? 'keins'}`,
        schema: Profile,
        applicantId: m.applicantId,
        maxTokens: 900,
      })) ??
      {
        headline: `${anon} — ${o?.title ?? 'Kandidat:in'}, verfügbar ab ${o?.startDate ?? 'nach Absprache'}`,
        sections: [
          { title: 'Qualifikation', lines: usable.filter((f) => f.key.startsWith('education.')).map((f) => `${f.label}: ${f.value}`) },
          { title: 'Berufserfahrung', lines: usable.filter((f) => f.key.startsWith('experience.')).map((f) => `${f.label}: ${f.value}`) },
          { title: 'Sprache', lines: [`Deutsch: ${lang.proven ?? lang.claimed ?? 'A1'}${lang.proven ? ' (Zertifikat)' : ' (Eigenangabe)'}`] },
          { title: 'Verfügbarkeit', lines: [`Start möglich: ${o?.startDate ?? 'nach Absprache'}`, `Zielstadt: ${st.applicant.targetCity ?? o?.city ?? 'flexibel'}`] },
        ].filter((s) => s.lines.length),
      };

    const [row] = await db.update(schema.matches).set({ germanProfile: profile, status: 'profile_ready' }).where(eq(schema.matches.id, matchId)).returning();
    return this.matchDTO(row, st.applicant.name);
  }

  /** Nothing leaves without a human tap: this creates the approval, it does not send. */
  async sendMatch(matchId: string) {
    const m = await db.query.matches.findFirst({ where: eq(schema.matches.id, matchId) });
    if (!m) throw new NotFoundException();
    const o = await db.query.openings.findFirst({ where: eq(schema.openings.id, m.openingId) });
    const st = await this.state.load(m.applicantId);
    const p = (m.germanProfile as any) ?? (await this.profile(matchId)).germanProfile;
    const body = [
      `Guten Tag ${o?.employer ?? ''},`,
      '',
      `wir schlagen Ihnen eine Kandidatin / einen Kandidaten für Ihre Stelle "${o?.title ?? ''}" in ${o?.city ?? ''} vor.`,
      '',
      p?.headline ?? '',
      ...(p?.sections ?? []).flatMap((s: any) => ['', `${s.title}:`, ...s.lines.map((l: string) => `· ${l}`)]),
      '',
      'Das Profil ist anonymisiert, bis die Person der Weitergabe zustimmt. Bei Interesse organisieren wir ein Gespräch.',
      '',
      'Mit freundlichen Grüßen',
      'Educaro',
    ].join('\n');

    const [a] = await db
      .insert(schema.approvals)
      .values({
        applicantId: m.applicantId,
        kind: 'employer_profile',
        title: `Send ${st.applicant.name}'s profile to ${o?.employer ?? 'the employer'}`,
        needsApplicant: true,
        needsStaff: true,
        payload: {
          to: o?.employerEmail ?? '',
          cc: [],
          replyTo: this.mail.replyAddress(m.applicantId),
          subject: `Kandidatenvorschlag: ${o?.title ?? ''} (${o?.city ?? ''})`,
          body,
          sentences: [],
          keywords: o?.keywords ?? [],
          attachments: [],
          targetUrl: null,
          matchId,
        },
      })
      .returning();
    await db.update(schema.matches).set({ status: 'sent' }).where(eq(schema.matches.id, matchId));
    await this.chat.agentSays(
      m.applicantId,
      `An employer, ${o?.employer ?? ''}, is looking for a ${o?.title ?? 'role'} in ${o?.city ?? ''}. Educaro prepared an anonymised German profile for you — nothing goes out until you approve it.`,
    );
    return a;
  }

  // ---------------- batch planner ----------------

  /** When does each applicant need to start which German course? Counted per month, computed in code. */
  async batchPlanner(): Promise<BatchPlanDTO> {
    const applicants = await db.select().from(schema.applicants);
    const buckets = new Map<string, { A2: number; B1: number; B2: number }>();
    const totals = { A2: 0, B1: 0, B2: 0 };

    for (const a of applicants) {
      const st = await this.state.load(a.id);
      const report = runChecks(st);
      const lang = germanLevels(st);
      let have = cefrIndex(lang.proven ?? lang.claimed ?? null);
      const need = cefrIndex(report.language.need ?? null);
      if (need <= 0) continue;
      const cursor = new Date();
      for (let lvl = have + 1; lvl <= need; lvl++) {
        const name = (['A1', 'A2', 'B1', 'B2', 'C1'] as const)[lvl - 1];
        if (name === 'A2' || name === 'B1' || name === 'B2') {
          const key = monthLabel({ y: cursor.getFullYear(), m: cursor.getMonth() + 1 });
          const b = buckets.get(key) ?? { A2: 0, B1: 0, B2: 0 };
          b[name] += 1;
          totals[name] += 1;
          buckets.set(key, b);
        }
        cursor.setMonth(cursor.getMonth() + Math.round(WEEKS_PER_LEVEL / 4.33));
      }
    }
    const months = Array.from(buckets.entries())
      .map(([month, v]) => ({ month, ...v }))
      .sort((x, y) => x.month.localeCompare(y.month));
    return { months, totals };
  }

  // ---------------- broadcasts ----------------

  async broadcasts(): Promise<BroadcastDTO[]> {
    const rows = await db.select().from(schema.broadcasts).orderBy(desc(schema.broadcasts.createdAt));
    return rows.map((b) => ({ id: b.id, topic: b.topic, status: b.status, messages: b.messages, createdAt: b.createdAt.toISOString() }));
  }

  /** One message per person, each one about their own file — not a mailshot. */
  async createBroadcast(topic: string): Promise<BroadcastDTO> {
    const applicants = await db.select().from(schema.applicants);
    const messages: BroadcastDTO['messages'] = [];
    for (const a of applicants.slice(0, 25)) {
      const st = await this.state.load(a.id);
      const report = runChecks(st);
      const gap = report.gaps[0];
      const lang = germanLevels(st);
      const personal = [
        gap ? `your next step is ${midSentence(gap.title)} (${gap.howLong})` : 'your file is complete',
        `German: ${lang.proven ?? lang.claimed ?? 'not started'}`,
        a.route ? ROUTE_LABEL[a.route as Route] : 'route not decided',
      ].join('; ');
      const text =
        (await this.llm.text({
          task: 'broadcast_line',
          tier: 'cheap',
          system: 'Write ONE short, warm message (max 45 words) to an applicant about the given topic, mentioning their own situation. Plain English, no greeting line, no sign-off.',
          user: `TOPIC: ${topic}\nTHEIR SITUATION: ${personal}`,
          maxTokens: 160,
        })) ?? `${topic} — for you specifically: ${personal}. Open your plan and I will walk you through it.`;
      messages.push({ applicantId: a.id, name: a.name, text: text.trim() });
    }
    const [b] = await db.insert(schema.broadcasts).values({ topic, messages }).returning();
    return { id: b.id, topic: b.topic, status: b.status, messages: b.messages, createdAt: b.createdAt.toISOString() };
  }

  async approveBroadcast(id: string): Promise<BroadcastDTO> {
    const b = await db.query.broadcasts.findFirst({ where: eq(schema.broadcasts.id, id) });
    if (!b) throw new NotFoundException();
    for (const m of b.messages) await this.chat.agentSays(m.applicantId, m.text);
    const [row] = await db.update(schema.broadcasts).set({ status: 'sent' }).where(eq(schema.broadcasts.id, id)).returning();
    await this.trace.record('plan', 'broadcast_sent', { topic: b.topic, count: b.messages.length });
    return { id: row.id, topic: row.topic, status: row.status, messages: row.messages, createdAt: row.createdAt.toISOString() };
  }

  // ---------------- mail tracker ----------------

  private async trackerMeta() {
    const rows = await db.select().from(schema.emails).orderBy(desc(schema.emails.createdAt)).limit(300);
    const applicants = await db.select().from(schema.applicants);
    const names = new Map(applicants.map((a) => [a.id, a.name]));
    return { rows, names };
  }

  private trackerItem(m: any, meta: Awaited<ReturnType<StaffService['trackerMeta']>>): MailTrackerItemDTO {
    const addr = (x: any) => (typeof x === 'string' ? x : x?.Address ?? x?.address ?? '');
    const to: string[] = (m.To ?? []).map(addr).filter(Boolean);
    const subject = m.Subject ?? '';
    const tags: string[] = m.Tags ?? [];
    const row = meta.rows.find((r) => r.subject === subject && Math.abs(new Date(r.createdAt).getTime() - new Date(m.Created ?? Date.now()).getTime()) < 10 * 60_000);
    const applicantId = row?.applicantId ?? tags.find((t) => t.startsWith('applicant:'))?.slice(10) ?? null;
    const originalTo = row?.originalTo ? [row.originalTo] : to;
    return {
      mailpitId: m.ID,
      direction: (row?.direction as 'out' | 'in') ?? (tags.includes('in') ? 'in' : 'out'),
      from: addr(m.From),
      to,
      originalTo,
      subject,
      snippet: (m.Snippet ?? row?.text ?? '').slice(0, 180),
      applicantId,
      applicantName: applicantId ? meta.names.get(applicantId) ?? null : null,
      kind: row?.kind ?? tags.find((t) => t.startsWith('kind:'))?.slice(5) ?? null,
      safeRedirected: row?.safeRedirected ?? false,
      createdAt: new Date(m.Created ?? Date.now()).toISOString(),
    };
  }

  async mailTracker(applicantId?: string, limit = 100): Promise<MailTrackerItemDTO[]> {
    const meta = await this.trackerMeta();
    const list = await this.mail.trackerList(limit);
    let items = list.map((m) => this.trackerItem(m, meta));
    if (!items.length) {
      // Mailpit is not running: fall back to our own log, so the tracker is never empty in a demo.
      items = meta.rows.slice(0, limit).map((r) => ({
        mailpitId: `db:${r.id}`,
        direction: r.direction,
        from: r.fromAddr,
        to: [r.toAddr],
        originalTo: r.originalTo ? [r.originalTo] : [r.toAddr],
        subject: r.subject,
        snippet: r.text.slice(0, 180),
        applicantId: r.applicantId,
        applicantName: r.applicantId ? meta.names.get(r.applicantId) ?? null : null,
        kind: r.kind,
        safeRedirected: r.safeRedirected,
        createdAt: r.createdAt.toISOString(),
      }));
    }
    return applicantId ? items.filter((i) => i.applicantId === applicantId) : items;
  }

  async mailTrackerDetail(mailpitId: string): Promise<MailTrackerDetailDTO> {
    const meta = await this.trackerMeta();
    if (mailpitId.startsWith('db:')) {
      const r = meta.rows.find((x) => x.id === mailpitId.slice(3));
      if (!r) throw new NotFoundException();
      const base = (await this.mailTracker(undefined, 300)).find((i) => i.mailpitId === mailpitId);
      return { ...(base as MailTrackerItemDTO), text: r.text, html: null, attachments: [] };
    }
    const m = await this.mail.trackerGet(mailpitId);
    if (!m) throw new NotFoundException();
    const item = this.trackerItem({ ...m, Snippet: (m.Text ?? '').slice(0, 180) }, meta);
    return { ...item, text: m.Text ?? '', html: m.HTML ?? null, attachments: (m.Attachments ?? []).map((a: any) => ({ name: a.FileName ?? a.Filename ?? 'file', size: a.Size ?? 0 })) };
  }

  // ---------------- trace and stats ----------------

  async traceLog(applicantId?: string, limit = 200) {
    const q = db.select().from(schema.traces).orderBy(desc(schema.traces.createdAt)).limit(Math.min(500, limit));
    const rows = applicantId ? await db.select().from(schema.traces).where(eq(schema.traces.applicantId, applicantId)).orderBy(desc(schema.traces.createdAt)).limit(Math.min(500, limit)) : await q;
    return rows.map((t) => ({
      id: t.id,
      applicantId: t.applicantId,
      runId: t.runId,
      kind: t.kind as any,
      name: t.name,
      detail: t.detail,
      costUsd: t.costUsd,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  async stats(): Promise<StatsDTO> {
    const applicants = await db.select().from(schema.applicants);
    const traces = await db.select().from(schema.traces).where(eq(schema.traces.kind, 'llm'));
    const per = new Map<string, { costUsd: number; llmCalls: number; cachedCalls: number }>();
    for (const t of traces) {
      const k = t.applicantId ?? 'shared';
      const v = per.get(k) ?? { costUsd: 0, llmCalls: 0, cachedCalls: 0 };
      v.costUsd += t.costUsd;
      if ((t.detail as any)?.cached) v.cachedCalls += 1;
      else v.llmCalls += 1;
      per.set(k, v);
    }
    return {
      llm: this.llm.status(),
      applicants: applicants.length,
      costPerApplicant: applicants.map((a) => ({
        applicantId: a.id,
        name: a.name,
        costUsd: Math.round((per.get(a.id)?.costUsd ?? 0) * 10000) / 10000,
        llmCalls: per.get(a.id)?.llmCalls ?? 0,
        cachedCalls: per.get(a.id)?.cachedCalls ?? 0,
      })),
    };
  }

  systemStatus() {
    return { llm: this.llm.status(), discord: Boolean(config.discordToken), mailpitUrl: config.mailpitUrl };
  }
}
