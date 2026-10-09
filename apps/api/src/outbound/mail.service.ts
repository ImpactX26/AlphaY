import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import * as nodemailer from 'nodemailer';
import { z } from 'zod';
import { config } from '../config';
import { db, schema } from '../db/db';
import { LlmService } from '../llm/llm.service';
import { QueueService } from '../queue/queue.service';
import { TraceService } from '../trace/trace.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface OutMail {
  applicantId: string | null;
  approvalId?: string | null;
  kind: 'application' | 'notification' | 'invite' | 'digest' | 'employer_profile' | 'broadcast' | 'reply' | 'simulated';
  to: string[];
  cc?: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string | null;
  attachments?: { filename: string; content?: Buffer | string; path?: string; contentType?: string }[];
  icalEvent?: { filename: string; method: 'REQUEST' | 'PUBLISH'; content: string };
  extraHeaders?: Record<string, string>;
}

export const ReplyClass = z.object({
  kind: z.enum(['interview', 'missing_paper', 'rejection', 'other']),
  summary: z.string(),
  interviewAt: z.string().nullable(),
  location: z.string().nullable(),
  missingPaper: z.string().nullable(),
});
export type ReplyClass = z.infer<typeof ReplyClass>;

export type InboundHandler = (applicantId: string, mail: { emailId: string; from: string; subject: string; text: string; cls: ReplyClass }) => Promise<void>;

/**
 * Mail through the team's own mailbox (nodemailer SMTP, IMAP for replies), with Mailpit as the tracker:
 * every message in or out is mirrored there, tagged by applicant and direction.
 * Safe mode redirects any third-party recipient to the team inbox, so the prototype never mails a real office.
 */
@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Mail');
  private primary!: nodemailer.Transporter;
  private mirror: nodemailer.Transporter | null = null;
  private timer: NodeJS.Timeout | null = null;
  private polling = false;
  private inboundHandler: InboundHandler | null = null;
  readonly realMailbox = !!(config.smtpUser && config.smtpPass);

  constructor(
    private readonly llm: LlmService,
    private readonly q: QueueService,
    private readonly trace: TraceService,
    private readonly rt: RealtimeGateway,
  ) {}

  onModuleInit() {
    const mailpit = nodemailer.createTransport({ host: 'localhost', port: 1025, secure: false, tls: { rejectUnauthorized: false } });
    if (this.realMailbox) {
      this.primary = nodemailer.createTransport({ host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure, auth: { user: config.smtpUser, pass: config.smtpPass } });
      this.mirror = mailpit;
      this.timer = setInterval(() => void this.pollImap(), Math.max(10, config.mailPollSeconds) * 1000);
      this.log.log(`real mailbox ${config.smtpUser} (safe mode ${config.mailSafeMode ? 'on' : 'OFF'}), Mailpit mirror on`);
    } else {
      this.primary = mailpit;
      this.log.log('no SMTP credentials: sending to Mailpit only');
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  onInbound(handler: InboundHandler) {
    this.inboundHandler = handler;
  }

  /** The address replies come back to: plus-addressing on the team mailbox. */
  replyAddress(applicantId: string): string {
    const tag = `a${applicantId.replace(/-/g, '').slice(0, 10)}`;
    const base = this.realMailbox ? config.smtpUser : 'agent@educaro.local';
    const [local, domain] = base.split('@');
    return `${local}+${tag}@${domain}`;
  }

  private teamBase(addr: string) {
    const [local, domain] = addr.toLowerCase().split('@');
    return `${local.split('+')[0]}@${domain}`;
  }

  private isAllowed(addr: string): boolean {
    const a = addr.toLowerCase().trim();
    if (this.realMailbox && this.teamBase(a) === this.teamBase(config.smtpUser)) return true;
    if (!this.realMailbox) return true; // Mailpit catches everything; nothing leaves the machine.
    return config.mailAllowed.some((x) => (x.startsWith('@') ? a.endsWith(x) : a === x));
  }

  safeRecipients(list: string[]): { to: string[]; original: string[]; redirected: boolean } {
    const original = list.map((x) => x.trim()).filter(Boolean);
    if (!config.mailSafeMode) return { to: original, original, redirected: false };
    let redirected = false;
    const to = original.map((x) => {
      if (this.isAllowed(x)) return x;
      redirected = true;
      return config.mailSafeRedirect;
    });
    return { to: [...new Set(to)], original, redirected };
  }

  async send(m: OutMail): Promise<{ messageId: string; threadKey: string; to: string[]; redirected: boolean }> {
    const to = this.safeRecipients(m.to);
    const cc = this.safeRecipients(m.cc ?? []);
    const redirected = to.redirected || cc.redirected;
    const messageId = `<${randomUUID()}@educaro.agent>`;
    let threadKey = messageId;
    if (m.inReplyTo) {
      const parent = await db.query.emails.findFirst({ where: eq(schema.emails.messageId, m.inReplyTo) });
      threadKey = parent?.threadKey ?? m.inReplyTo;
    }
    const short = m.applicantId ? m.applicantId.replace(/-/g, '').slice(0, 10) : 'none';
    const headers: Record<string, string> = {
      'X-Educaro-Kind': m.kind,
      'X-Educaro-Applicant': m.applicantId ?? '',
      'X-Educaro-Original-To': to.original.join(', '),
      'X-Tags': ['educaro', 'out', `kind-${m.kind}`, `app-${short}`, ...(redirected ? ['safe-redirect'] : [])].join(','),
      ...(m.extraHeaders ?? {}),
    };
    const subject = redirected ? `[to: ${to.original.join(', ')}] ${m.subject}` : m.subject;
    const mail: nodemailer.SendMailOptions = {
      from: config.mailFrom,
      to: to.to,
      cc: cc.to.length ? cc.to : undefined,
      replyTo: m.replyTo,
      subject,
      text: m.text,
      html: m.html,
      messageId,
      inReplyTo: m.inReplyTo ?? undefined,
      references: m.inReplyTo ?? undefined,
      attachments: m.attachments,
      icalEvent: m.icalEvent,
      headers,
    };
    await this.primary.sendMail(mail);
    if (this.mirror) await this.mirror.sendMail(mail).catch((e) => this.log.warn(`mirror failed: ${e?.message}`));
    await db.insert(schema.emails).values({
      applicantId: m.applicantId,
      approvalId: m.approvalId ?? null,
      direction: 'out',
      messageId,
      inReplyTo: m.inReplyTo ?? null,
      threadKey,
      fromAddr: config.mailFrom,
      toAddr: to.to.join(', '),
      subject,
      text: m.text,
      kind: m.kind,
      originalTo: to.original.join(', '),
      safeRedirected: redirected,
    });
    await this.trace.record('email', 'send_email', { kind: m.kind, to: to.to, originalTo: to.original, redirected, subject }, { applicantId: m.applicantId });
    if (m.applicantId) this.rt.toBoth(m.applicantId, { type: 'refresh', applicantId: m.applicantId, what: ['emails'] });
    return { messageId, threadKey, to: to.to, redirected };
  }

  // ---------------- inbound ----------------

  async classify(applicantId: string | null, subject: string, text: string): Promise<ReplyClass> {
    const llm = await this.llm.json({
      task: 'classify_reply',
      tier: 'cheap',
      system:
        'You classify a reply from a university or employer to an applicant. kind: interview (an invitation), missing_paper (they ask for a document), rejection, or other. interviewAt as ISO 8601 with timezone if a date and time are given, else null. summary: one sentence.',
      user: `Subject: ${subject}\n\n${text.slice(0, 3000)}`,
      schema: ReplyClass,
      applicantId,
      maxTokens: 800,
    });
    if (llm) return llm;
    const t = `${subject}\n${text}`;
    const kind = /interview|vorstellungsgespr|invite you/i.test(t) ? 'interview' : /missing|please (send|upload|provide)|nachreichen/i.test(t) ? 'missing_paper' : /unfortunately|regret|not (be )?able to offer|absage/i.test(t) ? 'rejection' : 'other';
    const date = t.match(/(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})/);
    return {
      kind,
      summary: kind === 'interview' ? 'Interview invitation' : kind === 'missing_paper' ? 'They ask for a document' : kind === 'rejection' ? 'Not successful this time' : 'Reply received',
      interviewAt: date ? new Date(`${date[1]}T${date[2].padStart(5, '0')}:00+02:00`).toISOString() : null,
      location: /video|teams|zoom|online/i.test(t) ? 'Video call' : null,
      missingPaper: kind === 'missing_paper' ? (t.match(/(?:send|upload|provide)\s+(?:us\s+)?(?:your\s+)?([a-z ]{4,40})/i)?.[1] ?? 'a document') : null,
    };
  }

  /** Store, mirror to the tracker, classify, hand to the agent. */
  async processInbound(applicantId: string, m: { from: string; to: string; subject: string; text: string; messageId: string; inReplyTo: string | null }) {
    const exists = await db.query.emails.findFirst({ where: eq(schema.emails.messageId, m.messageId) });
    if (exists) return;
    let threadKey = m.messageId;
    if (m.inReplyTo) {
      const parent = await db.query.emails.findFirst({ where: eq(schema.emails.messageId, m.inReplyTo) });
      threadKey = parent?.threadKey ?? m.inReplyTo;
    }
    const cls = await this.classify(applicantId, m.subject, m.text);
    const [row] = await db
      .insert(schema.emails)
      .values({ applicantId, direction: 'in', messageId: m.messageId, inReplyTo: m.inReplyTo, threadKey, fromAddr: m.from, toAddr: m.to, subject: m.subject, text: m.text, kind: 'reply', classified: cls })
      .returning();
    if (this.mirror || !this.realMailbox) {
      const short = applicantId.replace(/-/g, '').slice(0, 10);
      const tracker = this.mirror ?? this.primary;
      await tracker
        .sendMail({
          from: m.from,
          to: m.to,
          subject: m.subject,
          text: m.text,
          messageId: `<in-${randomUUID()}@educaro.tracker>`,
          headers: { 'X-Tags': ['educaro', 'in', `reply-${cls.kind}`, `app-${short}`].join(','), 'X-Educaro-Applicant': applicantId, 'X-Educaro-Inbound-Of': m.messageId },
        })
        .catch((e) => this.log.warn(`tracker mirror failed: ${e?.message}`));
    }
    await this.trace.record('email', 'read_replies', { from: m.from, subject: m.subject, kind: cls.kind, summary: cls.summary }, { applicantId });
    this.rt.toBoth(applicantId, { type: 'refresh', applicantId, what: ['emails'] });
    await this.inboundHandler?.(applicantId, { emailId: row.id, from: m.from, subject: m.subject, text: m.text, cls });
  }

  private async pollImap() {
    if (this.polling || !this.realMailbox) return;
    this.polling = true;
    let client: any = null;
    try {
      const { ImapFlow } = await import('imapflow');
      const { simpleParser } = await import('mailparser');
      client = new ImapFlow({ host: config.imapHost, port: config.imapPort, secure: true, auth: { user: config.smtpUser, pass: config.smtpPass }, logger: false });
      /**
       * An error listener, attached before connecting, because the absence of one is fatal.
       *
       * ImapFlow is an EventEmitter and the socket dies on its own schedule: Gmail resets an idle
       * IMAP connection routinely, and the ECONNRESET arrives as an `error` event long after
       * `connect()` resolved — outside the promise chain, so the try/catch around this never sees
       * it. Node's rule for an `error` event with no listener is to throw it process-wide, so a
       * dropped mail connection was taking the entire API down with it: every route, the websocket,
       * the agent loop, mid-demo. Polling again in thirty seconds is the correct response to a
       * reset socket; dying is not.
       */
      client.on('error', (err: any) => this.log.warn(`IMAP connection dropped: ${err?.message ?? err}. Will retry on the next poll.`));
      client.on('close', () => undefined);
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const key = 'mail:imap:lastUid';
        let last = Number((await this.q.redis.get(key)) ?? 0);
        if (!last) {
          // First run: start from now, never process the mailbox's history.
          last = Number(client.mailbox?.uidNext ?? 1) - 1;
          await this.q.redis.set(key, String(last));
        }
        const uids: number[] = (await client.search({ uid: `${last + 1}:*` }, { uid: true })) || [];
        for (const uid of uids.filter((u) => u > last).sort((a, b) => a - b)) {
          const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
          const parsed: any = await simpleParser(msg.source);
          await this.q.redis.set(key, String(uid));
          const isOurOutgoing = !!parsed.headers.get('x-educaro-kind') && parsed.headers.get('x-educaro-kind') !== 'simulated';
          if (isOurOutgoing) continue;
          const toAll = [parsed.to?.text, parsed.cc?.text, parsed.headers.get('delivered-to')].filter(Boolean).join(' ');
          const refs = [parsed.inReplyTo, ...(Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [])].filter(Boolean) as string[];
          const applicantId = await this.matchApplicant(toAll, refs);
          if (!applicantId) continue;
          await this.processInbound(applicantId, {
            from: parsed.from?.text ?? '',
            to: parsed.to?.text ?? '',
            subject: parsed.subject ?? '(no subject)',
            text: (parsed.text ?? '').split(/\n>|\nOn .{5,80} wrote:/)[0].trim(),
            messageId: parsed.messageId ?? `<imap-${uid}@educaro>`,
            inReplyTo: refs[0] ?? null,
          });
        }
      } finally {
        lock.release();
      }
    } catch (e: any) {
      this.log.warn(`IMAP poll failed: ${e?.message ?? e}`);
    } finally {
      this.polling = false;
      // logout() talks to a server that may already be gone; close() just drops the socket.
      await client?.logout().catch(() => undefined);
      try {
        client?.close?.();
      } catch {
        // Already closed. Nothing here is worth a line in the log.
      }
    }
  }

  private async matchApplicant(toAll: string, refs: string[]): Promise<string | null> {
    if (refs.length) {
      const parent = await db.query.emails.findFirst({ where: inArray(schema.emails.messageId, refs) });
      if (parent?.applicantId) return parent.applicantId;
    }
    const m = toAll.match(/\+a([0-9a-f]{10})@/i);
    if (m) {
      const rows = await db.query.applicants.findMany({ columns: { id: true } });
      return rows.find((r) => r.id.replace(/-/g, '').startsWith(m[1].toLowerCase()))?.id ?? null;
    }
    return null;
  }

  /** Demo helper: the employer answers the latest application. With a real mailbox it travels through IMAP for real. */
  async simulateReply(applicantId: string, kind: 'interview' | 'missing_paper' | 'rejection') {
    const last = await db.query.emails.findFirst({
      where: and(eq(schema.emails.applicantId, applicantId), eq(schema.emails.direction, 'out'), eq(schema.emails.kind, 'application')),
      orderBy: desc(schema.emails.createdAt),
    });
    const applicant = await db.query.applicants.findFirst({ where: eq(schema.applicants.id, applicantId) });
    const employer = last?.originalTo?.split(',')[0]?.trim() || 'hr@partner-klinik.de';
    const when = new Date(Date.now() + 6 * 86_400_000);
    when.setHours(10, 0, 0, 0);
    const iso = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')} 10:00`;
    const name = applicant?.name ?? 'Applicant';
    const bodies = {
      interview: `Dear ${name},\n\nthank you for your application. We would like to invite you to an interview on ${iso} (CET) via video call (Microsoft Teams). Please confirm the date.\n\nKind regards\nRecruiting Team`,
      missing_paper: `Dear ${name},\n\nthank you for your application. Please send us your nursing council registration certificate so we can complete your file.\n\nKind regards\nRecruiting Team`,
      rejection: `Dear ${name},\n\nthank you for your interest. Unfortunately we are not able to offer you a position at this time.\n\nKind regards\nRecruiting Team`,
    } as const;
    const subject = `Re: ${last?.subject.replace(/^\[to:[^\]]*\]\s*/, '') ?? 'Your application'}`;
    if (this.realMailbox) {
      await this.primary.sendMail({
        from: `Recruiting (simulated, for ${employer}) <${config.smtpUser}>`,
        to: this.replyAddress(applicantId),
        subject,
        text: bodies[kind],
        inReplyTo: last?.messageId,
        references: last?.messageId,
        headers: { 'X-Educaro-Kind': 'simulated' },
      });
      await this.trace.record('email', 'simulate_reply', { kind, via: 'real mailbox, arrives through IMAP' }, { applicantId });
    } else {
      await this.processInbound(applicantId, { from: employer, to: this.replyAddress(applicantId), subject, text: bodies[kind], messageId: `<sim-${randomUUID()}@employer>`, inReplyTo: last?.messageId ?? null });
    }
  }

  // ---------------- tracker (Mailpit API) ----------------

  async trackerList(limit = 100): Promise<any[]> {
    try {
      const res = await fetch(`${config.mailpitUrl}/api/v1/messages?limit=${limit}`);
      const j: any = await res.json();
      return j.messages ?? [];
    } catch {
      return [];
    }
  }

  async trackerGet(id: string): Promise<any | null> {
    try {
      const res = await fetch(`${config.mailpitUrl}/api/v1/message/${encodeURIComponent(id)}`);
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }
}
