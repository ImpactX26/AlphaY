import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import type { ApprovalDTO, ApprovalDetailDTO } from '@educaro/shared';
import { db, schema } from '../db/db';
import { GuardError, GuardsService } from '../agent/guards.service';
import { AgentEventsService } from '../agent/events.service';
import { StateService } from '../agent/state.service';
import { toFactDTO } from '../profile/facts.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { StorageService } from '../storage/storage.service';
import { ChatService } from '../profile/chat.service';
import { TraceService } from '../trace/trace.service';
import type { AuthUser } from '../auth/jwt';
import { MailService } from './mail.service';
import { PackService } from './pack.service';

type Row = typeof schema.approvals.$inferSelect;

export const toApprovalDTO = (a: Row): ApprovalDTO => ({
  id: a.id,
  applicantId: a.applicantId,
  kind: a.kind,
  title: a.title,
  payload: a.payload,
  status: a.status,
  needsStaff: a.needsStaff,
  applicantApprovedAt: a.applicantApprovedAt?.toISOString() ?? null,
  staffApprovedAt: a.staffApprovedAt?.toISOString() ?? null,
  createdAt: a.createdAt.toISOString(),
});

/** Nothing leaves without a human tap. The agent never approves itself. */
@Injectable()
export class ApprovalsService {
  constructor(
    private readonly guards: GuardsService,
    private readonly mail: MailService,
    private readonly pack: PackService,
    private readonly state: StateService,
    private readonly storage: StorageService,
    private readonly events: AgentEventsService,
    private readonly trace: TraceService,
    private readonly rt: RealtimeGateway,
    private readonly chat: ChatService,
  ) {}

  list(applicantId: string) {
    return db.query.approvals.findMany({ where: eq(schema.approvals.applicantId, applicantId), orderBy: (a, { desc }) => desc(a.createdAt) });
  }

  async detail(id: string): Promise<ApprovalDetailDTO> {
    const a = await db.query.approvals.findFirst({ where: eq(schema.approvals.id, id) });
    if (!a) throw new NotFoundException();
    const ids = [...new Set(((a.payload as any).sentences ?? []).flatMap((s: any) => s.factIds as string[]))] as string[];
    const facts = ids.length ? await db.query.facts.findMany({ where: inArray(schema.facts.id, ids) }) : [];
    return { ...toApprovalDTO(a), facts: facts.map(toFactDTO) };
  }

  async approve(id: string, user: AuthUser, edits: { subject?: string; body?: string } = {}): Promise<Row> {
    const a = await db.query.approvals.findFirst({ where: eq(schema.approvals.id, id) });
    if (!a) throw new NotFoundException();
    if (user.role === 'applicant' && user.applicantId !== a.applicantId) throw new ForbiddenException();
    const patch: Partial<Row> = {};
    if (user.role === 'applicant') {
      patch.applicantApprovedAt = new Date();
      if (edits.subject || edits.body) patch.payload = { ...a.payload, ...(edits.subject ? { subject: edits.subject } : {}), ...(edits.body ? { body: edits.body, edited: true } : {}) };
    } else if (user.role === 'staff') {
      patch.staffApprovedAt = new Date();
      if (!a.needsApplicant) patch.applicantApprovedAt = a.applicantApprovedAt;
    }
    const [updated] = await db.update(schema.approvals).set(patch).where(eq(schema.approvals.id, id)).returning();
    await this.trace.record('approval', 'approve', { approvalId: id, by: user.role, title: a.title }, { applicantId: a.applicantId });
    const ready = (!updated.needsApplicant || updated.applicantApprovedAt) && (!updated.needsStaff || updated.staffApprovedAt);
    if (ready) return this.execute(updated);
    this.rt.toBoth(a.applicantId, { type: 'refresh', applicantId: a.applicantId, what: ['approvals'] });
    return updated;
  }

  async reject(id: string, user: AuthUser): Promise<Row> {
    const a = await db.query.approvals.findFirst({ where: eq(schema.approvals.id, id) });
    if (!a) throw new NotFoundException();
    if (user.role === 'applicant' && user.applicantId !== a.applicantId) throw new ForbiddenException();
    const [row] = await db.update(schema.approvals).set({ status: 'rejected' }).where(eq(schema.approvals.id, id)).returning();
    await this.trace.record('approval', 'reject', { approvalId: id, by: user.role }, { applicantId: a.applicantId });
    this.rt.toBoth(a.applicantId, { type: 'refresh', applicantId: a.applicantId, what: ['approvals'] });
    return row;
  }

  private async execute(a: Row): Promise<Row> {
    const p = a.payload as any;
    try {
      await this.guards.assertApproved({ applicantId: a.applicantId }, a.id);
    } catch (e) {
      if (e instanceof GuardError) return a;
      throw e;
    }
    let status: Row['status'] = 'approved';
    if (a.kind === 'email' && p.mode === 'email' && p.to) {
      const st = await this.state.load(a.applicantId);
      const attachments: { filename: string; content: Buffer }[] = [{ filename: 'Lebenslauf.pdf', content: await this.pack.lebenslaufPdf(st) }];
      for (const att of (p.attachments ?? []) as { name: string; fileId?: string }[]) {
        if (!att.fileId) continue;
        const f = st.files.find((x) => x.id === att.fileId);
        if (f) attachments.push({ filename: f.originalName, content: await this.storage.read(f.storagePath) });
      }
      await this.mail.send({
        applicantId: a.applicantId,
        approvalId: a.id,
        kind: 'application',
        to: [p.to],
        cc: p.cc ?? [],
        replyTo: p.replyTo,
        subject: p.subject,
        text: p.body,
        attachments,
      });
      status = 'sent';
    } else if (a.kind === 'email' && p.mode === 'portal') {
      // A university is applied to through a portal, not by email, so there is no recipient to
      // send to — and approving used to leave the applicant on a screen where nothing happened.
      // The pack goes to them instead, ready to upload, with the portal link and the deadline.
      const st = await this.state.load(a.applicantId);
      const attachments: { filename: string; content: Buffer }[] = [{ filename: 'Lebenslauf.pdf', content: await this.pack.lebenslaufPdf(st) }];
      for (const att of (p.attachments ?? []) as { name: string; fileId?: string }[]) {
        if (!att.fileId) continue;
        const f = st.files.find((x) => x.id === att.fileId);
        if (f) attachments.push({ filename: f.originalName, content: await this.storage.read(f.storagePath) });
      }
      const where = p.targetUrl ? `\n\nUpload it here: ${p.targetUrl}` : '';
      await this.mail.send({
        applicantId: a.applicantId,
        approvalId: a.id,
        kind: 'application',
        to: [st.applicant.email ?? ''].filter(Boolean),
        replyTo: p.replyTo,
        subject: `Ready to submit: ${p.subject}`,
        text: `This application is approved and ready. It goes through the portal rather than by email, so everything you need is attached.${where}\n\n---\n\n${p.body}`,
        attachments,
      });
      await this.chat.agentSays(
        a.applicantId,
        `Your application for ${p.subject.replace(/^Application for /, '')} is ready. It is a portal application, so I have emailed you the letter and every document as one pack — upload it and you are done.`,
      );
      status = 'sent';
    } else if (a.kind === 'employer_profile' && p.to) {
      await this.mail.send({ applicantId: a.applicantId, approvalId: a.id, kind: 'employer_profile', to: [p.to], subject: p.subject, text: p.body });
      status = 'sent';
    }
    const [row] = await db.update(schema.approvals).set({ status, sentAt: status === 'sent' ? new Date() : null }).where(eq(schema.approvals.id, a.id)).returning();
    this.rt.toBoth(a.applicantId, { type: 'refresh', applicantId: a.applicantId, what: ['approvals', 'emails'] });
    await this.events.wake(a.applicantId, { type: 'approval', detail: { approvalId: a.id, status } });
    return row;
  }
}
