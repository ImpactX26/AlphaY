import { Injectable, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/db';
import { BusService } from '../common/bus.service';
import { ChatService } from '../profile/chat.service';
import { QuestionsService } from '../profile/questions.service';
import { TraceService } from '../trace/trace.service';
import { CalendarService } from '../outbound/calendar.service';
import { MailService } from '../outbound/mail.service';
import { WriterService } from '../outbound/writer.service';
import { AgentEventsService } from './events.service';
import { StateService } from './state.service';
import type { Plan } from './supervisor.service';

/** "Act outside" moves, plus what happens when the outside world answers. */
@Injectable()
export class ActionsService implements OnModuleInit {
  constructor(
    private readonly writer: WriterService,
    private readonly calendar: CalendarService,
    private readonly mail: MailService,
    private readonly chat: ChatService,
    private readonly questions: QuestionsService,
    private readonly events: AgentEventsService,
    private readonly state: StateService,
    private readonly bus: BusService,
    private readonly trace: TraceService,
  ) {}

  onModuleInit() {
    this.mail.onInbound((applicantId, m) => this.onReply(applicantId, m));
    this.bus.on('notify', (n) => this.notify(n.applicantId, n.title, n.text, n.ics));
    this.bus.on('agent_message', async (m) => {
      if (m.channel === 'email') await this.notify(m.applicantId, 'Message from your Educaro agent', m.text);
    });
  }

  async run(applicantId: string, o: Plan['outside'][number], runId: string) {
    if (o.action === 'draft_application' && o.targetId) {
      const a = await this.writer.draftApplication(applicantId, o.targetId, runId);
      if (a) await this.chat.agentSays(applicantId, `I drafted "${a.title}". Nothing is sent until you approve it.`);
    } else if (o.action === 'book_consultant') {
      await this.bookConsultant(applicantId, o.note, runId);
    } else if (o.action === 'notify_applicant' && o.note) {
      await this.chat.agentSays(applicantId, o.note);
    }
  }

  async bookConsultant(applicantId: string, note: string, runId?: string) {
    const when = new Date(Date.now() + 2 * 86_400_000);
    when.setUTCHours(5, 30, 0, 0); // 11:00 IST
    const ev = await this.calendar.create(applicantId, { title: 'Call with your Educaro consultant', kind: 'event', startsAt: when, durationMin: 30, location: 'Video call', description: note }, { notify: true, runId });
    await this.trace.record('tool', 'book_consultant', { when: when.toISOString(), note }, { applicantId, runId });
    await this.chat.agentSays(applicantId, `I booked a call with an Educaro consultant on ${when.toUTCString().slice(0, 16)} at 11:00 IST. They get a one-page brief, so you won't have to repeat yourself.`);
    return ev;
  }

  /** Notifications to the applicant themselves (their own inbox/calendar), so no third-party approval is needed. */
  async notify(applicantId: string, title: string, text: string, ics?: string) {
    const a = await db.query.applicants.findFirst({ where: eq(schema.applicants.id, applicantId) });
    if (!a?.email) return;
    await this.mail.send({
      applicantId,
      kind: ics ? 'invite' : 'notification',
      to: [a.email],
      replyTo: this.mail.replyAddress(applicantId),
      subject: title,
      text,
      icalEvent: ics ? { filename: 'invite.ics', method: 'REQUEST', content: ics } : undefined,
    });
  }

  private async onReply(applicantId: string, m: { emailId: string; from: string; subject: string; text: string; cls: any }) {
    const cls = m.cls;
    const who = m.from.replace(/<.*>/, '').trim() || 'The employer';
    if (cls.kind === 'interview') {
      const startsAt = cls.interviewAt ? new Date(cls.interviewAt) : new Date(Date.now() + 6 * 86_400_000);
      await this.calendar.create(applicantId, { title: `Interview: ${who}`, kind: 'interview', startsAt, durationMin: 45, location: cls.location ?? 'Video call', description: cls.summary }, { notify: true });
      await db.update(schema.applicants).set({ stage: 'matched', stageReason: `Interview invitation from ${who}` }).where(eq(schema.applicants.id, applicantId));
      await this.chat.agentSays(applicantId, `Good news: ${who} invited you to an interview on ${startsAt.toUTCString().slice(0, 22)} UTC. It's in your calendar, and a mock interview is ready when you are.`, 'web');
      this.bus.emit('agent_message', { applicantId, text: `Interview invitation from ${who}: ${startsAt.toUTCString().slice(0, 22)} UTC. It's in your calendar.`, channel: 'discord' });
    } else if (cls.kind === 'missing_paper') {
      await this.questions.ask(
        applicantId,
        { id: `reply:${m.emailId}`, prompt: `${who} asks for ${cls.missingPaper ?? 'a document'}. Can you upload it?`, why: 'Your application is on hold until they have it.', options: ['Upload now', "I don't have it yet"], factKey: null, actions: {} },
        { runId: `reply_${m.emailId.slice(0, 8)}` },
      );
    } else if (cls.kind === 'rejection') {
      const st = await this.state.load(applicantId);
      const next = st.shortlist.find((s) => !m.subject.includes(s.title));
      await this.chat.agentSays(applicantId, `${who} won't continue this time. That happens to most applicants on the way.${next ? ` Next on your shortlist: ${next.title}. Shall I draft that one?` : ' Let’s add another option to your shortlist.'}`);
    } else {
      await this.chat.agentSays(applicantId, `A reply arrived from ${who}: ${cls.summary}`);
    }
    await this.events.wake(applicantId, { type: 'email_reply', detail: { kind: cls.kind, summary: cls.summary } });
  }
}
