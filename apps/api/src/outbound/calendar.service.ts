import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as ics from 'ics';
import { db, schema } from '../db/db';
import { BusService } from '../common/bus.service';
import { TraceService } from '../trace/trace.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

type Kind = 'deadline' | 'exam' | 'task' | 'event' | 'interview';

/** Invites, not reminders: every date becomes a calendar event with an .ics file. */
@Injectable()
export class CalendarService {
  constructor(
    private readonly bus: BusService,
    private readonly trace: TraceService,
    private readonly rt: RealtimeGateway,
  ) {}

  async create(
    applicantId: string,
    e: { title: string; kind: Kind; startsAt: Date; durationMin?: number; location?: string | null; description?: string | null },
    opts: { notify?: boolean; runId?: string } = {},
  ) {
    const existing = await db.query.calendarEvents.findMany({ where: eq(schema.calendarEvents.applicantId, applicantId) });
    const dup = existing.find((x) => x.title === e.title && Math.abs(+x.startsAt - +e.startsAt) < 60_000);
    if (dup) return dup;
    const [row] = await db
      .insert(schema.calendarEvents)
      .values({ applicantId, title: e.title, kind: e.kind, startsAt: e.startsAt, durationMin: e.durationMin ?? 60, location: e.location ?? null, description: e.description ?? null })
      .returning();
    await this.trace.record('tool', 'create_event', { title: e.title, kind: e.kind, startsAt: e.startsAt.toISOString() }, { applicantId, runId: opts.runId });
    this.rt.toBoth(applicantId, { type: 'refresh', applicantId, what: ['calendar'] });
    if (opts.notify) {
      // The applicant's own calendar: a notification to them, not an outbound action to a third party.
      this.bus.emit('notify', {
        applicantId,
        title: `Calendar: ${e.title}`,
        text: `${e.title}\n${e.startsAt.toUTCString()}${e.location ? `\n${e.location}` : ''}\n\nThe invite is attached.`,
        ics: this.ics(row),
      });
    }
    return row;
  }

  ics(e: typeof schema.calendarEvents.$inferSelect): string {
    const d = e.startsAt;
    const { value, error } = ics.createEvent({
      start: [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()],
      startInputType: 'utc',
      startOutputType: 'utc',
      duration: { minutes: e.durationMin },
      title: e.title,
      description: e.description ?? undefined,
      location: e.location ?? undefined,
      status: 'CONFIRMED',
      productId: 'educaro/agent',
      uid: `${e.id}@educaro.agent`,
    });
    if (error || !value) throw error ?? new Error('ics failed');
    return value;
  }
}
