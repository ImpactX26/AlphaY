import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db/db';
import { TraceService } from '../trace/trace.service';

export const MAX_OPEN_QUESTIONS = 2;

export class GuardError extends Error {
  constructor(public readonly guard: string, message: string) {
    super(message);
  }
}

const squash = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’“”"'`´]/g, '')
    .replace(/[–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * The six guards. Plain code the model cannot talk its way past.
 *  1. No source, no save: web facts need a page opened in this run, and the quote must be on it.
 *  2. Required checks cannot be skipped (see agent/checks.ts, enforced by the loop).
 *  3. CVs and letters use only Verified and You-said facts.
 *  4. Nothing leaves the system for a third party without a human tap.
 *  5. Two open questions at most, never one a document already answers.
 *  6. Names, passport numbers and phone numbers never go into web searches.
 * Every rejection is written to the trace, so staff can see the guard working.
 */
@Injectable()
export class GuardsService {
  constructor(private readonly trace: TraceService) {}

  private async reject(guard: string, message: string, ctx: { applicantId?: string | null; runId?: string | null }, detail: Record<string, unknown> = {}): Promise<never> {
    await this.trace.record('guard', guard, { blocked: true, message, ...detail }, ctx);
    throw new GuardError(guard, message);
  }

  /** Guard 1. */
  async assertSourced(
    ctx: { applicantId?: string | null; runId: string },
    url: string | null | undefined,
    quote: string | null | undefined,
  ): Promise<void> {
    if (!url || !quote) return this.reject('no_source_no_save', 'Web fact without a link and quote', ctx, { url, quote });
    const rows = await db
      .select({ text: schema.sources.text })
      .from(schema.sources)
      .where(and(eq(schema.sources.runId, ctx.runId), eq(schema.sources.url, url)));
    if (!rows.length) return this.reject('no_source_no_save', 'Link was not opened in this run', ctx, { url });
    const q = squash(quote);
    if (!rows.some((r) => squash(r.text).includes(q))) {
      return this.reject('no_source_no_save', 'The page does not contain the quoted text', ctx, { url, quote });
    }
  }

  /** Guard 3: only facts a writer may use. */
  writerFacts<T extends { tag: string }>(facts: T[]): T[] {
    return facts.filter((f) => f.tag === 'verified' || f.tag === 'said');
  }

  /** Guard 3, after generation: every referenced fact id must be Verified or You-said. */
  async assertWriterRefs(ctx: { applicantId: string; runId: string }, factIds: string[]): Promise<void> {
    if (!factIds.length) return;
    const rows = await db
      .select({ id: schema.facts.id, tag: schema.facts.tag })
      .from(schema.facts)
      .where(and(eq(schema.facts.applicantId, ctx.applicantId), inArray(schema.facts.id, factIds)));
    const bad = factIds.filter((id) => {
      const r = rows.find((x) => x.id === id);
      return !r || (r.tag !== 'verified' && r.tag !== 'said');
    });
    if (bad.length) await this.reject('writer_facts_only', 'Letter cites facts that are not Verified or You said', ctx, { bad });
  }

  /** Guard 4. Outbound to anyone other than the applicant needs an approved approval. */
  async assertApproved(ctx: { applicantId: string; runId?: string | null }, approvalId: string | null | undefined): Promise<typeof schema.approvals.$inferSelect> {
    if (!approvalId) return this.reject('human_tap', 'Outbound action without an approval', ctx);
    const a = await db.query.approvals.findFirst({ where: eq(schema.approvals.id, approvalId) });
    if (!a || a.applicantId !== ctx.applicantId) return this.reject('human_tap', 'Approval not found', ctx, { approvalId });
    if (a.needsApplicant && !a.applicantApprovedAt) return this.reject('human_tap', 'Waiting for the applicant to approve', ctx, { approvalId });
    if (a.needsStaff && !a.staffApprovedAt) return this.reject('human_tap', 'Waiting for the staff second key', ctx, { approvalId });
    if (a.status === 'sent') return this.reject('human_tap', 'Already sent', ctx, { approvalId });
    return a;
  }

  /** Guard 5. */
  async assertCanAsk(ctx: { applicantId: string; runId?: string | null }, factKey: string | null, candidateId: string | null): Promise<void> {
    const open = await db.query.questions.findMany({
      where: and(eq(schema.questions.applicantId, ctx.applicantId), eq(schema.questions.status, 'open')),
    });
    if (open.length >= MAX_OPEN_QUESTIONS) return this.reject('two_questions', 'Two questions are already open', ctx, { factKey });
    if (candidateId) {
      const asked = await db.query.questions.findMany({ where: eq(schema.questions.applicantId, ctx.applicantId) });
      if (asked.some((q) => q.meta?.candidateId === candidateId)) {
        return this.reject('two_questions', 'This question was already asked', ctx, { candidateId });
      }
    }
    if (factKey && !factKey.startsWith('conflict')) {
      const verified = await db.query.facts.findFirst({
        where: and(
          eq(schema.facts.applicantId, ctx.applicantId),
          eq(schema.facts.key, factKey),
          eq(schema.facts.tag, 'verified'),
          eq(schema.facts.active, true),
        ),
      });
      if (verified) return this.reject('two_questions', 'A document already answers this', ctx, { factKey });
    }
  }

  /** Guard 6. Returns the query unchanged, or throws when it carries personal data. */
  async assertCleanQuery(ctx: { applicantId?: string | null; runId?: string | null }, query: string, personal: string[]): Promise<string> {
    const q = query.toLowerCase();
    const hits = personal
      .map((p) => p.toLowerCase().trim())
      .filter((p) => p.length >= 4)
      .filter((p) => q.includes(p));
    const patterns = [
      /\b[a-z]\d{7}\b/i, // Indian passport number
      /(\+?91[\s-]?)?[6-9]\d{9}\b/, // Indian mobile
      /\b\d{4}\s?\d{4}\s?\d{4}\b/, // Aadhaar-like
      /[\w.+-]+@[\w-]+\.[\w.]+/, // email
    ];
    if (hits.length || patterns.some((r) => r.test(query))) {
      return this.reject('no_personal_data_in_search', 'Search query contained personal data', ctx, { query: '[redacted]' });
    }
    return query;
  }
}
