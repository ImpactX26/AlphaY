import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db, schema } from '../db/db';
import { QueueService } from '../queue/queue.service';
import { TraceService } from '../trace/trace.service';
import { ChatService } from '../profile/chat.service';
import { BusService } from '../common/bus.service';
import { StateService } from './state.service';
import { runChecks } from './checks';
import { AgentEventsService } from './events.service';
import { daysUntil, midSentence } from '../knowledge/normalize';
import { AnnouncementsService } from '../community/announcements.service';
import { WatchService } from '../watch/watch.service';

type Tick = { kind: 'deadlines' | 'recheck' | 'stalled' | 'announce' | 'watch' };

/**
 * The agent when nobody is looking.
 *
 * Everything else in the loop is a reaction: an upload, a message, a reply. An applicant's file
 * also goes stale on its own — a deadline gets close, a page they were quoted changes, a plan goes
 * untouched for a week — and none of that produces an event. Without this the product only ever
 * works while someone is watching it, which is the opposite of the promise.
 *
 * Three repeating jobs, all idempotent, all safe to run twice.
 */
@Injectable()
export class TimersService implements OnModuleInit {
  private readonly log = new Logger('Timers');

  constructor(
    private readonly q: QueueService,
    private readonly state: StateService,
    private readonly chat: ChatService,
    private readonly events: AgentEventsService,
    private readonly bus: BusService,
    private readonly trace: TraceService,
    private readonly announcements: AnnouncementsService,
    private readonly watch: WatchService,
  ) {}

  async onModuleInit() {
    this.q.process<Tick, void>('timers', (job) => this.tick(job.data.kind), 1);
    // Repeatable jobs are keyed by name + pattern, so re-registering on every boot is a no-op.
    await this.every('deadlines', '0 7 * * *'); // 07:00 UTC, before the Indian working day ends
    await this.every('recheck', '0 3 * * 1'); // Monday 03:00 UTC
    await this.every('stalled', '0 9 * * *');
    await this.every('announce', '0 6 * * 1'); // Monday morning, before the Indian working day gets going
    // Hourly, which only means "ask each source whether its own interval has elapsed" — the page a
    // university edits twice a year does not need reading every hour, and being polled that often
    // by us is not a thing we should do to them either.
    await this.every('watch', '7 * * * *');
    // Seeding and a first read happen in the background: a database that is not up yet must not
    // stop the API from booting, and the first read is the baseline, so it notifies nobody.
    void this.watch
      .ensureSeeded()
      .then(() => this.watch.checkDue())
      .catch((e) => this.log.warn(`watch seed: ${e.message}`));
    this.log.log('deadline pings, weekly re-check, stalled-file nudges, watched sources and the Monday announcements scheduled');
  }

  private async every(kind: Tick['kind'], pattern: string) {
    await this.q.add<Tick>('timers', kind, { kind }, { repeat: { pattern }, jobId: `repeat:${kind}` }).catch((e) => this.log.warn(`schedule ${kind}: ${e.message}`));
  }

  /** Exposed so the demo can show a week passing without waiting a week. */
  async runNow(kind: Tick['kind']) {
    return this.tick(kind);
  }

  private async tick(kind: Tick['kind']): Promise<void> {
    if (kind === 'watch') {
      await this.watch.checkDue();
      return;
    }
    if (kind === 'deadlines') return this.deadlines();
    if (kind === 'recheck') return this.recheck();
    if (kind === 'announce') {
      await this.announcements.publish();
      return;
    }
    return this.stalled();
  }

  // ---------------- deadlines ----------------

  /** One message per deadline, at 30, 14, 7 and 2 days out, and never the same one twice. */
  private async deadlines() {
    const now = new Date();
    const horizon = new Date(now.getTime() + 31 * 86_400_000);
    const rows = await db
      .select()
      .from(schema.calendarEvents)
      .where(and(gte(schema.calendarEvents.startsAt, now), lte(schema.calendarEvents.startsAt, horizon)));

    let sent = 0;
    for (const ev of rows) {
      const days = daysUntil(ev.startsAt);
      const step = days === null ? undefined : [30, 14, 7, 2].find((d) => days === d);
      if (!step || days === null) continue;
      const marker = `ping:${ev.id}:${step}`;
      // The trace is the ledger: if we already pinged at this step, there is a row for it.
      const already = await db.query.traces.findFirst({ where: eq(schema.traces.name, marker) });
      if (already) continue;

      const st = await this.state.load(ev.applicantId);
      const report = runChecks(st);
      const blocking = report.gaps[0];
      const text =
        days <= 2
          ? `${ev.title} is in ${days} day${days === 1 ? '' : 's'}.${blocking ? ` The one thing still open is ${midSentence(blocking.title)} — ${blocking.howLong}.` : ' Everything on your side is ready.'}`
          : `${ev.title} is ${days} days away.${blocking ? ` To be comfortable, ${midSentence(blocking.title)} needs ${blocking.howLong}, so this is the moment to start it.` : ' You are on track.'}`;

      await this.chat.agentSays(ev.applicantId, text);
      this.bus.emit('agent_message', { applicantId: ev.applicantId, text, channel: 'discord' });
      this.bus.emit('notify', { applicantId: ev.applicantId, title: ev.title, text, channels: ['email'] });
      await this.trace.record('event', marker, { days, event: ev.title }, { applicantId: ev.applicantId });
      sent += 1;
    }
    if (sent) this.log.log(`${sent} deadline ping${sent === 1 ? '' : 's'}`);
  }

  // ---------------- weekly re-check ----------------

  /**
   * Pages move. A requirement quoted six weeks ago may not be on the page any more, and an
   * applicant acting on a stale rule is the failure mode that costs them a semester. The
   * fact-checker re-opens what we cited and the agent reacts to whatever it finds.
   */
  private async recheck() {
    const applicants = await db.select().from(schema.applicants);
    const active = applicants.filter((a) => a.stage !== 'germany' && a.route);
    for (const a of active) {
      await this.events.wake(a.id, { type: 'timer', detail: { reason: 'weekly_recheck', specialist: 'factcheck' } }, 0);
    }
    await this.trace.record('event', 'weekly_recheck', { applicants: active.length });
    this.log.log(`weekly re-check queued for ${active.length} applicant(s)`);
  }

  // ---------------- stalled files ----------------

  /** A file nobody has touched in a week, with a question still open, gets one nudge. */
  private async stalled() {
    const applicants = await db.select().from(schema.applicants);
    const week = 7 * 86_400_000;
    let nudged = 0;
    for (const a of applicants) {
      if (Date.now() - a.updatedAt.getTime() < week) continue;
      const st = await this.state.load(a.id);
      const open = st.questions.filter((q) => q.status === 'open');
      if (!open.length) continue;
      const marker = `nudge:${a.id}:${Math.floor(Date.now() / week)}`;
      if (await db.query.traces.findFirst({ where: eq(schema.traces.name, marker) })) continue;
      const text = `Your plan is waiting on one answer from you: ${open[0].prompt} Answer it and I will carry on from there.`;
      await this.chat.agentSays(a.id, text);
      this.bus.emit('agent_message', { applicantId: a.id, text, channel: 'discord' });
      await this.trace.record('event', marker, { question: open[0].prompt }, { applicantId: a.id });
      nudged += 1;
    }
    if (nudged) this.log.log(`${nudged} stalled file(s) nudged`);
  }
}
