import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { DocKind } from '@educaro/shared';
import { db, schema } from '../db/db';
import { TraceService } from '../trace/trace.service';
import { ChatService } from '../profile/chat.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { checkDocument, DEFAULT_STANDARDS, type DocStandard, type DocVerdict, type StandardRule } from '../knowledge/standards';

/**
 * The standards an uploaded document is measured against.
 *
 * Kept in the database rather than in the source because they are a policy, not a constant: an
 * Anerkennung office changes what it will accept and a consultant has to be able to follow that on
 * a Tuesday afternoon without a deploy. The code ships defaults; the admin panel owns them after
 * the first boot.
 *
 * The evaluation itself is entirely rule-based (see `knowledge/standards.ts`). A model is allowed
 * to read a document and pull fields off it; it is not allowed to decide whether somebody's
 * paperwork is acceptable, because that answer has to be the same twice and has to be explainable
 * to the person it is about.
 */
@Injectable()
export class StandardsService {
  private readonly log = new Logger('Standards');

  constructor(
    private readonly trace: TraceService,
    private readonly chat: ChatService,
    private readonly rt: RealtimeGateway,
  ) {}

  /** Writes the shipped defaults once, so a fresh database has a standard for every kind. */
  async ensureSeeded() {
    for (const s of DEFAULT_STANDARDS) {
      const existing = await db.query.docStandards.findFirst({ where: eq(schema.docStandards.docKind, s.docKind) });
      if (existing) continue;
      await db.insert(schema.docStandards).values({
        docKind: s.docKind,
        label: s.label,
        authority: s.authority,
        rules: s.rules as unknown as Record<string, unknown>[],
      });
    }
  }

  async list() {
    const rows = await db.select().from(schema.docStandards).orderBy(schema.docStandards.label);
    return rows.map((r) => ({
      id: r.id,
      docKind: r.docKind as DocKind,
      label: r.label,
      authority: r.authority,
      active: r.active,
      rules: r.rules as unknown as StandardRule[],
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async update(id: string, input: { authority?: string; active?: boolean; rules?: StandardRule[] }) {
    await db
      .update(schema.docStandards)
      .set({
        ...(input.authority !== undefined ? { authority: input.authority } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.rules !== undefined ? { rules: input.rules as unknown as Record<string, unknown>[] } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.docStandards.id, id));
    await this.trace.record('event', 'standard_updated', { id, rules: input.rules?.length });
    return this.list();
  }

  private async standardFor(kind: DocKind): Promise<DocStandard | null> {
    const row = await db.query.docStandards.findFirst({ where: eq(schema.docStandards.docKind, kind) });
    if (row) {
      if (!row.active) return null;
      return { docKind: row.docKind as DocKind, label: row.label, authority: row.authority, rules: row.rules as unknown as StandardRule[] };
    }
    // A database that has not been seeded yet must not silently accept everything.
    return DEFAULT_STANDARDS.find((s) => s.docKind === kind) ?? null;
  }

  /**
   * Check one document, and tell the applicant when it will not be accepted.
   *
   * Only a blocking failure is worth interrupting somebody for. A warning is shown on the document
   * and waits for them to come looking, because a notification for every stale date is how people
   * learn to ignore all of them.
   */
  async check(applicantId: string, kind: DocKind, extracted: Record<string, unknown>, text: string, runId?: string): Promise<DocVerdict | null> {
    const standard = await this.standardFor(kind).catch(() => null);
    if (!standard) return null;

    const passportName = await this.passportName(applicantId);
    const verdict = checkDocument(standard, { extracted, text, passportName });

    await this.trace.record(
      'guard',
      'document_standard',
      { kind, standard: standard.label, verdict: verdict.verdict, blocking: verdict.blocking, warnings: verdict.warnings },
      { applicantId, runId },
    );

    if (verdict.verdict === 'not_accepted') {
      const failed = verdict.checks.filter((c) => !c.passed && c.severity === 'blocking');
      await this.chat.agentSays(
        applicantId,
        `I read that ${standard.label.toLowerCase()}, and as it stands it will not be accepted. ${failed
          .map((f) => f.because)
          .join(' ')} I check this against ${standard.authority}, so this is their bar rather than mine — tell me if you think it is wrong and a consultant will look.`,
      );
      this.rt.toStaff({ type: 'refresh', applicantId, what: ['files'] });
    }
    return verdict;
  }

  /** The name on their passport, which every other document is matched against. */
  private async passportName(applicantId: string): Promise<string | null> {
    const files = await db.select().from(schema.files).where(eq(schema.files.applicantId, applicantId)).orderBy(desc(schema.files.createdAt));
    const passport = files.find((f) => f.kind === 'passport' && f.extracted);
    const fromPassport = (passport?.extracted as any)?.holderName;
    if (fromPassport) return String(fromPassport);
    // Falling back to the identity fact keeps the rule working before a passport is uploaded, which
    // is most of the first session. Scoped to this applicant in the query rather than filtered
    // afterwards: matching on the key alone finds whichever row the database returns first, which
    // belongs to somebody else almost every time, and then the name check silently had nothing to
    // compare against.
    const fact = await db.query.facts.findFirst({
      where: and(eq(schema.facts.applicantId, applicantId), eq(schema.facts.key, 'identity.name')),
    });
    return fact?.value ?? null;
  }

  /** Re-check every document on a file against the current standards. */
  async recheck(applicantId: string) {
    const files = await db.select().from(schema.files).where(eq(schema.files.applicantId, applicantId));
    let changed = 0;
    for (const f of files) {
      if (!f.extracted || !f.text || f.kind === 'cv' || f.kind === 'video') continue;
      const verdict = await this.check(applicantId, f.kind as DocKind, f.extracted as Record<string, unknown>, f.text);
      if (!verdict) continue;
      await db.update(schema.files).set({ checkResult: verdict as unknown as Record<string, unknown> }).where(eq(schema.files.id, f.id));
      changed += 1;
    }
    this.rt.toApplicant(applicantId, { type: 'refresh', applicantId, what: ['files'] });
    return { rechecked: changed };
  }

  /** Staff view: every document we hold that will not be accepted, newest first. */
  async failing() {
    const files = await db.select().from(schema.files).orderBy(desc(schema.files.createdAt)).limit(300);
    const applicants = await db.select().from(schema.applicants);
    const names = new Map(applicants.map((a) => [a.id, a.name]));
    return files
      .filter((f) => (f.checkResult as any)?.verdict === 'not_accepted')
      .slice(0, 60)
      .map((f) => {
        const v = f.checkResult as unknown as DocVerdict;
        return {
          fileId: f.id,
          applicantId: f.applicantId,
          applicantName: names.get(f.applicantId) ?? 'Unknown',
          originalName: f.originalName,
          docKind: f.kind,
          standard: v.standard,
          authority: v.authority,
          failed: v.checks.filter((c) => !c.passed && c.severity === 'blocking').map((c) => ({ rule: c.rule, found: c.found, expected: c.expected, because: c.because })),
          createdAt: f.createdAt.toISOString(),
        };
      });
  }
}
