import { Controller, Get, Param } from '@nestjs/common';
import type { ApprovalDTO, CalendarEventDTO, EmailDTO, GapDTO, ReadinessDTO, ShortlistDTO } from '@educaro/shared';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '../db/db';
import type { AuthUser } from '../auth/jwt';
import { assertCanSee, CurrentUser } from './auth.guard';

/**
 * The applicant's plan side: shortlist, gaps, readiness, approvals, mail and calendar.
 *
 * Every row here is written by Claude A's services (scout, gap finder, writer, mail). These
 * are reads, so each one returns whatever is in the table — an empty list before A's side runs,
 * which the web app already renders as a real empty state.
 */
@Controller('applicants')
export class PlanController {
  @Get(':id/shortlist')
  async shortlist(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ShortlistDTO[]> {
    assertCanSee(user, id);
    const rows = await db.select().from(schema.shortlist).where(eq(schema.shortlist.applicantId, id)).orderBy(asc(schema.shortlist.createdAt));
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      subtitle: r.subtitle,
      url: r.url,
      status: r.status,
      gapCount: r.gapCount,
      matrix: (r.matrix as ShortlistDTO['matrix']) ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  @Get(':id/gaps')
  async gaps(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<GapDTO[]> {
    assertCanSee(user, id);
    const rows = await db.select().from(schema.gaps).where(eq(schema.gaps.applicantId, id)).orderBy(asc(schema.gaps.priority));
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      title: r.title,
      what: r.what,
      where: r.where,
      howLong: r.howLong,
      cost: r.cost,
      links: r.links ?? [],
      // The service catalogue is A's; until it lands the gap still shows with no service attached.
      service: null,
      status: r.status,
      shortlistId: r.shortlistId,
    }));
  }

  /**
   * Readiness is computed in code, never by a model (CLAUDE.md). Until A's calculator lands this
   * reports the honest zero state rather than inventing a score.
   */
  @Get(':id/readiness')
  async readiness(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ReadinessDTO> {
    assertCanSee(user, id);
    const gaps = await db.select({ status: schema.gaps.status }).from(schema.gaps).where(eq(schema.gaps.applicantId, id));
    const done = gaps.filter((g) => g.status === 'done').length;
    const overall = gaps.length ? Math.round((done / gaps.length) * 100) : 0;
    return {
      overall,
      outcome: gaps.length && done === gaps.length ? 'ready' : 'ready_after_plan',
      meters: [{ label: 'Plan steps done', value: overall }],
    };
  }

  @Get(':id/approvals')
  async approvals(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ApprovalDTO[]> {
    assertCanSee(user, id);
    const rows = await db.select().from(schema.approvals).where(eq(schema.approvals.applicantId, id)).orderBy(asc(schema.approvals.createdAt));
    return rows.map((r) => ({
      id: r.id,
      applicantId: r.applicantId,
      kind: r.kind,
      title: r.title,
      payload: r.payload,
      status: r.status,
      needsStaff: r.needsStaff,
      applicantApprovedAt: r.applicantApprovedAt?.toISOString() ?? null,
      staffApprovedAt: r.staffApprovedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  @Get(':id/emails')
  async emails(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<EmailDTO[]> {
    assertCanSee(user, id);
    const rows = await db.select().from(schema.emails).where(eq(schema.emails.applicantId, id)).orderBy(asc(schema.emails.createdAt));
    return rows.map((r) => ({
      id: r.id,
      direction: r.direction,
      fromAddr: r.fromAddr,
      toAddr: r.toAddr,
      subject: r.subject,
      text: r.text,
      threadKey: r.threadKey,
      classified: (r.classified as EmailDTO['classified']) ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  @Get(':id/calendar')
  async calendar(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<CalendarEventDTO[]> {
    assertCanSee(user, id);
    const rows = await db
      .select()
      .from(schema.calendarEvents)
      .where(eq(schema.calendarEvents.applicantId, id))
      .orderBy(asc(schema.calendarEvents.startsAt));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      startsAt: r.startsAt.toISOString(),
      durationMin: r.durationMin,
      location: r.location,
      description: r.description,
    }));
  }
}
