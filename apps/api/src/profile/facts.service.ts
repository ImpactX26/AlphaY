import { Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type { FactDTO, SourceKind, Tag } from '@educaro/shared';
import { db, schema } from '../db/db';
import { GuardError, GuardsService } from '../agent/guards.service';
import { TraceService } from '../trace/trace.service';

export interface FactInput {
  key: string;
  label: string;
  value: string;
  tag: Tag;
  sourceKind: SourceKind;
  sourceRef?: string | null;
  sourceUrl?: string | null;
  quote?: string | null;
  data?: Record<string, unknown> | null;
}

export type FactRow = typeof schema.facts.$inferSelect;

export function toFactDTO(f: FactRow): FactDTO {
  return {
    id: f.id,
    key: f.key,
    label: f.label,
    value: f.value,
    tag: f.tag,
    sourceKind: f.sourceKind,
    sourceRef: f.sourceRef,
    sourceUrl: f.sourceUrl,
    quote: f.quote,
    createdAt: f.createdAt.toISOString(),
  };
}

/** Rules that decide a tag, regardless of what a caller asks for. */
function enforceTag(f: FactInput): Tag {
  if (f.sourceKind === 'document') return 'verified';
  if (f.sourceKind === 'video' || f.sourceKind === 'cv' || f.sourceKind === 'applicant') return 'said';
  if (f.sourceKind === 'web') return 'web';
  return f.tag === 'verified' ? 'ai' : f.tag;
}

@Injectable()
export class FactsService {
  constructor(
    private readonly guards: GuardsService,
    private readonly trace: TraceService,
  ) {}

  /** Save with proof. Returns the row, or null when a guard rejected it. */
  async save(applicantId: string, f: FactInput, ctx: { runId: string }): Promise<FactRow | null> {
    const tag = enforceTag(f);
    if (tag === 'web') {
      try {
        await this.guards.assertSourced({ applicantId, runId: ctx.runId }, f.sourceUrl, f.quote);
      } catch (e) {
        if (e instanceof GuardError) return null;
        throw e;
      }
    }
    // A newer claim from the same source replaces the older one.
    await db
      .update(schema.facts)
      .set({ active: false })
      .where(
        and(
          eq(schema.facts.applicantId, applicantId),
          eq(schema.facts.key, f.key),
          eq(schema.facts.sourceKind, f.sourceKind),
          f.sourceRef ? eq(schema.facts.sourceRef, f.sourceRef) : eq(schema.facts.active, true),
        ),
      );
    const [row] = await db
      .insert(schema.facts)
      .values({
        applicantId,
        key: f.key,
        label: f.label,
        value: f.value.slice(0, 500),
        tag,
        sourceKind: f.sourceKind,
        sourceRef: f.sourceRef ?? null,
        sourceUrl: f.sourceUrl ?? null,
        quote: f.quote?.slice(0, 400) ?? null,
        data: f.data ?? null,
      })
      .returning();
    await this.trace.record('tool', 'save_fact', { key: f.key, tag, sourceKind: f.sourceKind, url: f.sourceUrl ?? undefined }, { applicantId, runId: ctx.runId });
    return row;
  }

  async saveMany(applicantId: string, items: FactInput[], ctx: { runId: string }): Promise<FactRow[]> {
    const out: FactRow[] = [];
    for (const f of items) {
      const r = await this.save(applicantId, f, ctx);
      if (r) out.push(r);
    }
    return out;
  }

  list(applicantId: string): Promise<FactRow[]> {
    return db.query.facts.findMany({
      where: and(eq(schema.facts.applicantId, applicantId), eq(schema.facts.active, true)),
      orderBy: asc(schema.facts.createdAt),
    });
  }

  async deactivate(applicantId: string, key: string, sourceKind?: SourceKind) {
    await db
      .update(schema.facts)
      .set({ active: false })
      .where(
        and(
          eq(schema.facts.applicantId, applicantId),
          eq(schema.facts.key, key),
          sourceKind ? eq(schema.facts.sourceKind, sourceKind) : eq(schema.facts.active, true),
        ),
      );
  }
}
