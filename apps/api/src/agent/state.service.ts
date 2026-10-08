import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db, schema } from '../db/db';
import { FactsService, type FactRow } from '../profile/facts.service';
import { analyseTruth, type TruthAnalysis } from '../profile/truth-map';

export type ApplicantRow = typeof schema.applicants.$inferSelect;
export type FileRow = typeof schema.files.$inferSelect;
export type QuestionRow = typeof schema.questions.$inferSelect;
export type ShortlistRow = typeof schema.shortlist.$inferSelect;
export type GapRow = typeof schema.gaps.$inferSelect;
export type ApprovalRow = typeof schema.approvals.$inferSelect;
export type CalendarRow = typeof schema.calendarEvents.$inferSelect;

export interface ApplicantState {
  applicant: ApplicantRow;
  files: FileRow[];
  facts: FactRow[];
  truth: TruthAnalysis;
  questions: QuestionRow[];
  shortlist: ShortlistRow[];
  gaps: GapRow[];
  approvals: ApprovalRow[];
  calendar: CalendarRow[];
  outputs: Record<string, { output: Record<string, any>; at: Date }>;
}

/** Best value for a key: document beats the applicant's own correction beats CV beats video. */
export function bestFact(state: Pick<ApplicantState, 'facts'>, key: string): FactRow | null {
  const order = ['document', 'applicant', 'web', 'cv', 'video', 'agent'];
  const rows = state.facts.filter((f) => f.key === key);
  rows.sort((a, b) => order.indexOf(a.sourceKind) - order.indexOf(b.sourceKind) || +b.createdAt - +a.createdAt);
  return rows[0] ?? null;
}

export function factData(state: Pick<ApplicantState, 'facts'>, key: string): Record<string, any> {
  return (bestFact(state, key)?.data ?? {}) as Record<string, any>;
}

@Injectable()
export class StateService {
  constructor(private readonly facts: FactsService) {}

  async applicant(applicantId: string): Promise<ApplicantRow> {
    const a = await db.query.applicants.findFirst({ where: eq(schema.applicants.id, applicantId) });
    if (!a) throw new NotFoundException('Applicant not found');
    return a;
  }

  async load(applicantId: string): Promise<ApplicantState> {
    const applicant = await this.applicant(applicantId);
    const [files, facts, questions, shortlist, gaps, approvals, calendar, outs] = await Promise.all([
      db.query.files.findMany({ where: eq(schema.files.applicantId, applicantId), orderBy: asc(schema.files.createdAt) }),
      this.facts.list(applicantId),
      db.query.questions.findMany({ where: eq(schema.questions.applicantId, applicantId), orderBy: asc(schema.questions.createdAt) }),
      db.query.shortlist.findMany({ where: eq(schema.shortlist.applicantId, applicantId), orderBy: asc(schema.shortlist.createdAt) }),
      db.query.gaps.findMany({ where: eq(schema.gaps.applicantId, applicantId), orderBy: asc(schema.gaps.priority) }),
      db.query.approvals.findMany({ where: eq(schema.approvals.applicantId, applicantId), orderBy: desc(schema.approvals.createdAt) }),
      db.query.calendarEvents.findMany({ where: eq(schema.calendarEvents.applicantId, applicantId), orderBy: asc(schema.calendarEvents.startsAt) }),
      db.query.specialistOutputs.findMany({ where: eq(schema.specialistOutputs.applicantId, applicantId) }),
    ]);
    const outputs: ApplicantState['outputs'] = {};
    for (const o of outs) outputs[o.specialist] = { output: o.output as Record<string, any>, at: o.createdAt };
    const truth = analyseTruth(facts, applicant.route);
    // Link open questions to their truth rows.
    for (const r of truth.rows) {
      const q = questions.find((x) => x.status === 'open' && (x.meta?.candidateId?.endsWith(r.key) ?? false));
      if (q) r.questionId = q.id;
    }
    return { applicant, files, facts, truth, questions, shortlist, gaps, approvals, calendar, outputs };
  }

  async saveOutput(applicantId: string, specialist: string, runId: string, output: Record<string, unknown>) {
    await db
      .insert(schema.specialistOutputs)
      .values({ applicantId, specialist, runId, output })
      .onConflictDoUpdate({
        target: [schema.specialistOutputs.applicantId, schema.specialistOutputs.specialist],
        set: { output, runId, createdAt: new Date() },
      });
  }

  async touch(applicantId: string, patch: Partial<ApplicantRow>) {
    await db.update(schema.applicants).set({ ...patch, updatedAt: new Date() }).where(eq(schema.applicants.id, applicantId));
  }

  openQuestions(state: ApplicantState) {
    return state.questions.filter((q) => q.status === 'open');
  }

  async experienceKeyResolver(applicantId: string) {
    const rows = await db.query.facts.findMany({
      where: and(eq(schema.facts.applicantId, applicantId), eq(schema.facts.active, true)),
    });
    return rows.filter((f) => f.key.startsWith('experience.') && f.key !== 'experience.total');
  }
}
