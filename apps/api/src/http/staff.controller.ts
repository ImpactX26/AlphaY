import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import type { PipelineCardDTO, StaffQueueItemDTO } from '@educaro/shared';
import { PipelineStage } from '@educaro/shared';
import { desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db/db';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CurrentUser, StaffOnly } from './auth.guard';
import type { AuthUser } from '../auth/jwt';

/**
 * The command centre. Staff-only (the guard enforces it for the whole controller).
 * Counts come from the tables A's services write, so the board is live from the first row.
 */
@StaffOnly()
@Controller('staff')
export class StaffController {
  constructor(private readonly realtime: RealtimeGateway) {}

  @Get('pipeline')
  async pipeline(): Promise<PipelineCardDTO[]> {
    const rows = await db.select().from(schema.applicants).orderBy(desc(schema.applicants.updatedAt));
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);

    // Three grouped reads instead of three queries per card.
    const [gaps, questions, approvals] = await Promise.all([
      db.select({ applicantId: schema.gaps.applicantId, status: schema.gaps.status }).from(schema.gaps).where(inArray(schema.gaps.applicantId, ids)),
      db
        .select({ applicantId: schema.questions.applicantId, status: schema.questions.status })
        .from(schema.questions)
        .where(inArray(schema.questions.applicantId, ids)),
      db
        .select({ applicantId: schema.approvals.applicantId, status: schema.approvals.status })
        .from(schema.approvals)
        .where(inArray(schema.approvals.applicantId, ids)),
    ]);

    const count = <T extends { applicantId: string; status: string }>(list: T[], id: string, status: string) =>
      list.filter((x) => x.applicantId === id && x.status === status).length;

    return rows.map((r) => {
      const openGaps = count(gaps, r.id, 'open');
      const doneGaps = count(gaps, r.id, 'done');
      const total = openGaps + doneGaps + count(gaps, r.id, 'planned');
      return {
        applicantId: r.id,
        name: r.name,
        subtitle: r.subtitle,
        route: (r.route as PipelineCardDTO['route']) ?? null,
        stage: r.stage as PipelineCardDTO['stage'],
        stageReason: r.stageReason,
        readiness: total ? Math.round((doneGaps / total) * 100) : 0,
        openGaps,
        openQuestions: count(questions, r.id, 'open'),
        pendingApprovals: count(approvals, r.id, 'pending'),
        // The truth map is A's; conflicts stay at zero until it lands rather than being guessed.
        conflicts: 0,
        updatedAt: r.updatedAt.toISOString(),
      };
    });
  }

  /** Dragging a card back asks for a reason, which is stored so the board explains itself. */
  @Post('applicants/:id/stage')
  async setStage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { stage?: string; reason?: string },
  ): Promise<PipelineCardDTO> {
    const parsed = PipelineStage.safeParse(body.stage);
    if (!parsed.success) throw new BadRequestException('That is not one of the eight stages.');
    const reason = body.reason?.trim();
    if (!reason) throw new BadRequestException('Say why you moved this card.');

    const [row] = await db
      .update(schema.applicants)
      .set({ stage: parsed.data, stageReason: `${reason} — ${user.name}`, updatedAt: new Date() })
      .where(eq(schema.applicants.id, id))
      .returning();
    if (!row) throw new NotFoundException('No such applicant.');

    // `pipeline` has its own message type, so the board can move the card without a refetch.
    this.realtime.toStaff({ type: 'pipeline', applicantId: id, stage: parsed.data, reason: row.stageReason ?? reason });
    this.realtime.toApplicant(id, { type: 'refresh', applicantId: id, what: ['applicant'] });

    const board = await this.pipeline();
    const card = board.find((c) => c.applicantId === id);
    if (!card) throw new NotFoundException('No such applicant.');
    return card;
  }

  /** Everything waiting on a human tap, newest first. */
  @Get('queue')
  async queue(): Promise<StaffQueueItemDTO[]> {
    const rows = await db.select().from(schema.approvals).where(eq(schema.approvals.status, 'pending')).orderBy(desc(schema.approvals.createdAt));
    if (!rows.length) return [];

    const names = await db
      .select({ id: schema.applicants.id, name: schema.applicants.name })
      .from(schema.applicants)
      .where(inArray(schema.applicants.id, [...new Set(rows.map((r) => r.applicantId))]));
    const nameOf = new Map(names.map((n) => [n.id, n.name]));

    return rows.map((r) => ({
      id: r.id,
      kind: r.kind === 'submit' ? 'submission' : 'approval',
      applicantId: r.applicantId,
      applicantName: nameOf.get(r.applicantId) ?? 'Unknown',
      title: r.title,
      detail: r.needsStaff ? 'Needs a second key from staff.' : 'Waiting on the applicant.',
      refId: r.id,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
