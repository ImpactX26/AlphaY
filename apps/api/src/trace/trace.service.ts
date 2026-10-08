import { Injectable } from '@nestjs/common';
import type { TraceDTO } from '@educaro/shared';
import { db, schema } from '../db/db';
import { RealtimeGateway } from '../realtime/realtime.gateway';

type Kind = TraceDTO['kind'];

/** Every plan, tool call, source link, approval and email, in order, with cost. */
@Injectable()
export class TraceService {
  constructor(private readonly rt: RealtimeGateway) {}

  async record(
    kind: Kind,
    name: string,
    detail: Record<string, unknown> = {},
    opts: { applicantId?: string | null; runId?: string | null; costUsd?: number } = {},
  ): Promise<void> {
    const [row] = await db
      .insert(schema.traces)
      .values({
        kind,
        name,
        detail,
        applicantId: opts.applicantId ?? null,
        runId: opts.runId ?? null,
        costUsd: opts.costUsd ?? 0,
      })
      .returning();
    this.rt.toStaff({
      type: 'trace',
      trace: { ...row, kind: row.kind as Kind, createdAt: row.createdAt.toISOString() },
    });
  }
}
