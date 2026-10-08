import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { Response } from 'express';
import type {
  ApplicantDTO,
  CalendarEventDTO,
  EmailDTO,
  FileDTO,
  GapDTO,
  InterviewDTO,
  ReadinessDTO,
  Screen,
  ShortlistDTO,
  TranscriptDTO,
  Route,
} from '@educaro/shared';
import { Route as RouteSchema } from '@educaro/shared';
import { db, schema } from '../db/db';
import { assertAccess, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { IngestService } from '../ingest/ingest.service';
import { MediaService } from '../media/media.service';
import { StateService } from '../agent/state.service';
import { runChecks } from '../agent/checks';
import { ComposerService } from '../agent/composer.service';
import { AgentEventsService } from '../agent/events.service';
import { ShortlistService } from '../agent/shortlist.service';
import { FactsService, toFactDTO } from '../profile/facts.service';
import { QuestionsService, toQuestionDTO } from '../profile/questions.service';
import { ChatService, toChatDTO } from '../profile/chat.service';
import { ApprovalsService, toApprovalDTO } from '../outbound/approvals.service';
import { CalendarService } from '../outbound/calendar.service';
import { PackService } from '../outbound/pack.service';
import { WriterService } from '../outbound/writer.service';
import { InterviewService } from '../agent/interview.service';
import { TraceService } from '../trace/trace.service';
import { service } from '../knowledge/services';

export function toApplicantDTO(a: typeof schema.applicants.$inferSelect): ApplicantDTO {
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    subtitle: a.subtitle,
    homeCity: a.homeCity,
    route: (a.route as Route) ?? null,
    routeAlternatives: (a.routeAlternatives as Route[]) ?? [],
    routeReasons: a.routeReasons ?? [],
    targetCity: a.targetCity,
    stage: a.stage as ApplicantDTO['stage'],
    stageReason: a.stageReason,
    mode: a.mode,
    staffSecondKey: a.staffSecondKey,
    submittedAt: a.submittedAt?.toISOString() ?? null,
    approvedByStaffAt: a.approvedByStaffAt?.toISOString() ?? null,
    cohortChannel: a.cohortChannel,
    createdAt: a.createdAt.toISOString(),
  };
}

export const toFileDTO = (f: typeof schema.files.$inferSelect): FileDTO => ({
  id: f.id,
  originalName: f.originalName,
  mime: f.mime,
  size: f.size,
  kind: f.kind,
  kindLabel: f.kindLabel,
  status: f.status,
  confidence: f.confidence,
  createdAt: f.createdAt.toISOString(),
});

export const toShortlistDTO = (s: typeof schema.shortlist.$inferSelect): ShortlistDTO => ({
  id: s.id,
  kind: s.kind,
  title: s.title,
  subtitle: s.subtitle,
  url: s.url,
  status: s.status,
  gapCount: s.gapCount,
  matrix: (s.matrix as ShortlistDTO['matrix']) ?? null,
  createdAt: s.createdAt.toISOString(),
});

export const toEmailDTO = (e: typeof schema.emails.$inferSelect): EmailDTO => ({
  id: e.id,
  direction: e.direction,
  fromAddr: e.fromAddr,
  toAddr: e.toAddr,
  subject: e.subject,
  text: e.text,
  threadKey: e.threadKey,
  classified: (e.classified as EmailDTO['classified']) ?? null,
  createdAt: e.createdAt.toISOString(),
});

export const toCalendarDTO = (c: typeof schema.calendarEvents.$inferSelect): CalendarEventDTO => ({
  id: c.id,
  title: c.title,
  kind: c.kind,
  startsAt: c.startsAt.toISOString(),
  durationMin: c.durationMin,
  location: c.location,
  description: c.description,
});

const MB = 1024 * 1024;

@Controller()
export class ApplicantController {
  constructor(
    private readonly q: QueueService,
    private readonly storage: StorageService,
    private readonly ingest: IngestService,
    private readonly media: MediaService,
    private readonly state: StateService,
    private readonly composer: ComposerService,
    private readonly events: AgentEventsService,
    private readonly shortlist: ShortlistService,
    private readonly facts: FactsService,
    private readonly questions: QuestionsService,
    private readonly chat: ChatService,
    private readonly approvals: ApprovalsService,
    private readonly calendar: CalendarService,
    private readonly pack: PackService,
    private readonly writer: WriterService,
    private readonly interview: InterviewService,
    private readonly trace: TraceService,
  ) {}

  @Get('applicants/:id')
  async get(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<ApplicantDTO> {
    assertAccess(u, id);
    return toApplicantDTO(await this.state.applicant(id));
  }

  @Get('applicants/:id/screen')
  async screen(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<Screen> {
    assertAccess(u, id);
    const row = await db.query.screens.findFirst({ where: eq(schema.screens.applicantId, id) });
    if (row) return row.data as unknown as Screen;
    const st = await this.state.load(id);
    return this.composer.compose(st, runChecks(st), `screen_${Date.now().toString(36)}`, false);
  }

  // ---------- story ----------
  @Post('applicants/:id/video')
  @UseInterceptors(FileInterceptor('video', { limits: { fileSize: 300 * MB } }))
  async video(@CurrentUser() u: AuthUser, @Param('id') id: string, @UploadedFile() file: Express.Multer.File): Promise<FileDTO> {
    assertAccess(u, id);
    if (!file) throw new BadRequestException('No video');
    return toFileDTO(await this.saveUpload(id, file));
  }

  @Post('applicants/:id/files')
  @UseInterceptors(FilesInterceptor('files', 30, { limits: { fileSize: 60 * MB } }))
  async files(@CurrentUser() u: AuthUser, @Param('id') id: string, @UploadedFiles() files: Express.Multer.File[]): Promise<FileDTO[]> {
    assertAccess(u, id);
    if (!files?.length) throw new BadRequestException('No files');
    const out: FileDTO[] = [];
    for (const f of files) out.push(toFileDTO(await this.saveUpload(id, f)));
    return out;
  }

  private async saveUpload(applicantId: string, f: Express.Multer.File) {
    const name = Buffer.from(f.originalname, 'latin1').toString('utf8');
    const rel = await this.storage.save(applicantId, name, f.buffer);
    const isMedia = this.media.isVideoOrAudio(f.mimetype, name);
    const [row] = await db
      .insert(schema.files)
      .values({ applicantId, originalName: name, mime: f.mimetype, size: f.size, storagePath: rel, kind: isMedia ? 'video' : 'other', kindLabel: isMedia ? 'Intro video' : null })
      .returning();
    await this.ingest.enqueue(row.id);
    await this.trace.record('event', 'upload', { file: name, size: f.size }, { applicantId });
    await this.events.wake(applicantId, { type: 'upload', detail: { fileId: row.id, queued: true } }, 300);
    return row;
  }

  @Get('applicants/:id/files')
  async listFiles(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<FileDTO[]> {
    assertAccess(u, id);
    const rows = await db.query.files.findMany({ where: eq(schema.files.applicantId, id), orderBy: asc(schema.files.createdAt) });
    return rows.map(toFileDTO);
  }

  @Get('files/:fileId/raw')
  async raw(@CurrentUser() u: AuthUser, @Param('fileId') fileId: string, @Res() res: Response) {
    const f = await db.query.files.findFirst({ where: eq(schema.files.id, fileId) });
    if (!f) throw new NotFoundException();
    assertAccess(u, f.applicantId);
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(f.originalName)}"`);
    res.sendFile(this.storage.abs(f.storagePath));
  }

  @Get('applicants/:id/transcript')
  async transcript(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<TranscriptDTO | null> {
    assertAccess(u, id);
    const v = await db.query.files.findFirst({
      where: and(eq(schema.files.applicantId, id), eq(schema.files.kind, 'video'), eq(schema.files.status, 'done')),
      orderBy: desc(schema.files.createdAt),
    });
    if (!v?.text) return null;
    const ex = (v.extracted ?? {}) as any;
    return { fileId: v.id, text: v.text, segments: ex.segments ?? [], provider: ex.provider ?? 'unknown' };
  }

  // ---------- profile ----------
  @Get('applicants/:id/facts')
  async listFacts(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    assertAccess(u, id);
    return (await this.facts.list(id)).filter((f) => !(f.data as any)?.sensitive || u.role === 'staff').map(toFactDTO);
  }

  @Get('applicants/:id/truth-map')
  async truthMap(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    assertAccess(u, id);
    return (await this.state.load(id)).truth.rows;
  }

  @Get('applicants/:id/questions')
  async listQuestions(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    assertAccess(u, id);
    const rows = await db.query.questions.findMany({ where: eq(schema.questions.applicantId, id), orderBy: desc(schema.questions.createdAt) });
    return rows.sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open')).map(toQuestionDTO);
  }

  @Post('questions/:qid/answer')
  async answer(@CurrentUser() u: AuthUser, @Param('qid') qid: string, @Body() b: { answer: string }) {
    const q = await db.query.questions.findFirst({ where: eq(schema.questions.id, qid) });
    if (!q) throw new NotFoundException();
    assertAccess(u, q.applicantId);
    if (!b?.answer?.trim()) throw new BadRequestException('Empty answer');
    return toQuestionDTO(await this.questions.answer(qid, b.answer.trim()));
  }

  @Get('applicants/:id/chat')
  async listChat(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    assertAccess(u, id);
    return (await this.chat.list(id)).map(toChatDTO);
  }

  @Post('applicants/:id/chat')
  async postChat(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: { text: string }) {
    assertAccess(u, id);
    if (!b?.text?.trim()) throw new BadRequestException('Empty message');
    if (u.role === 'staff') return toChatDTO(await this.chat.staffSays(id, b.text.trim()));
    if (b.text.trim() === 'submit') return toChatDTO(await this.chat.system(id, 'Use the Submit to Educaro button to send your profile for review.'));
    return toChatDTO(await this.chat.applicantSays(id, b.text.trim(), 'web'));
  }

  @Post('applicants/:id/voice-note')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 30 * MB } }))
  async voice(@CurrentUser() u: AuthUser, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    assertAccess(u, id);
    if (!file) throw new BadRequestException('No audio');
    const rel = await this.storage.save(id, file.originalname || 'voice.webm', file.buffer);
    const tr = await this.media.transcribe(this.storage.abs(rel));
    await this.trace.record('tool', 'transcribe_media', { kind: 'voice-note', provider: tr.provider, chars: tr.text.length }, { applicantId: id });
    return toChatDTO(await this.chat.applicantSays(id, tr.text || '(voice note could not be transcribed)', 'web'));
  }

  @Post('applicants/:id/route')
  async setRoute(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: { route: Route }) {
    assertAccess(u, id);
    const r = RouteSchema.safeParse(b?.route);
    if (!r.success) throw new BadRequestException('Unknown route');
    const a = await this.state.applicant(id);
    const alternatives = [...new Set([...(a.routeAlternatives ?? []), ...(a.route && a.route !== r.data ? [a.route] : [])])].filter((x) => x !== r.data);
    await this.state.touch(id, { route: r.data, routeAlternatives: alternatives, routeReasons: ['Chosen by the applicant'] });
    await this.events.wake(id, { type: 'route_set', detail: { route: r.data } });
    return toApplicantDTO(await this.state.applicant(id));
  }

  // ---------- shortlist ----------
  @Get('applicants/:id/shortlist')
  async listShortlist(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    assertAccess(u, id);
    const rows = await db.query.shortlist.findMany({ where: eq(schema.shortlist.applicantId, id), orderBy: asc(schema.shortlist.createdAt) });
    return rows.map(toShortlistDTO);
  }

  @Post('applicants/:id/shortlist')
  async addShortlist(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: { programmeId?: string; openingId?: string; url?: string }) {
    assertAccess(u, id);
    return toShortlistDTO(await this.shortlist.add(id, b ?? {}));
  }

  @Delete('shortlist/:sid')
  async removeShortlist(@CurrentUser() u: AuthUser, @Param('sid') sid: string) {
    const s = await db.query.shortlist.findFirst({ where: eq(schema.shortlist.id, sid) });
    if (!s) throw new NotFoundException();
    assertAccess(u, s.applicantId);
    return this.shortlist.remove(sid);
  }

  /** Ask the writer to draft the application for one shortlisted target (it waits for approval). */
  @Post('shortlist/:sid/draft')
  async draft(@CurrentUser() u: AuthUser, @Param('sid') sid: string) {
    const s = await db.query.shortlist.findFirst({ where: eq(schema.shortlist.id, sid) });
    if (!s) throw new NotFoundException();
    assertAccess(u, s.applicantId);
    const a = await this.writer.draftApplication(s.applicantId, sid, `draft_${Date.now().toString(36)}`);
    if (!a) throw new BadRequestException('Could not draft');
    await this.events.wake(s.applicantId, { type: 'approval', detail: { drafted: a.id } });
    return toApprovalDTO(a);
  }

  @Get('applicants/:id/gaps')
  async gaps(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<GapDTO[]> {
    assertAccess(u, id);
    const st = await this.state.load(id);
    const report = runChecks(st);
    return report.gaps.map((g) => {
      const row = st.gaps.find((x) => x.key === g.key);
      const svc = g.serviceId ? service(g.serviceId) : undefined;
      return {
        id: row?.id ?? g.key,
        key: g.key,
        title: g.title,
        what: g.what,
        where: g.where,
        howLong: g.howLong,
        cost: g.cost,
        links: g.links,
        service: svc ? { id: svc.id, name: svc.name, url: svc.url } : null,
        status: (row?.status as GapDTO['status']) ?? 'planned',
        shortlistId: g.shortlistId ?? null,
      };
    });
  }

  @Get('applicants/:id/readiness')
  async readiness(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<ReadinessDTO> {
    assertAccess(u, id);
    return runChecks(await this.state.load(id)).readiness;
  }

  // ---------- approvals ----------
  @Get('applicants/:id/approvals')
  async listApprovals(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    assertAccess(u, id);
    return (await this.approvals.list(id)).map(toApprovalDTO);
  }

  @Get('approvals/:aid')
  async approval(@CurrentUser() u: AuthUser, @Param('aid') aid: string) {
    const d = await this.approvals.detail(aid);
    assertAccess(u, d.applicantId);
    return d;
  }

  @Post('approvals/:aid/approve')
  async approve(@CurrentUser() u: AuthUser, @Param('aid') aid: string, @Body() b: { subject?: string; body?: string }) {
    return toApprovalDTO(await this.approvals.approve(aid, u, b ?? {}));
  }

  @Post('approvals/:aid/reject')
  async reject(@CurrentUser() u: AuthUser, @Param('aid') aid: string) {
    return toApprovalDTO(await this.approvals.reject(aid, u));
  }

  @Post('applicants/:id/submit')
  async submit(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    assertAccess(u, id);
    const a = await this.state.applicant(id);
    if (!a.submittedAt) {
      await this.state.touch(id, { submittedAt: new Date() });
      await db.insert(schema.approvals).values({ applicantId: id, kind: 'submit', title: `Submission: ${a.name}`, payload: { route: a.route }, needsApplicant: false, needsStaff: true });
      await this.trace.record('approval', 'submit_to_educaro', { name: a.name }, { applicantId: id });
      await this.events.wake(id, { type: 'approval', detail: { submitted: true } });
    }
    return toApplicantDTO(await this.state.applicant(id));
  }

  // ---------- documents out ----------
  @Get('applicants/:id/final-pack')
  async finalPack(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('format') format: string, @Res() res: Response) {
    assertAccess(u, id);
    const st = await this.state.load(id);
    const report = runChecks(st);
    const docx = format === 'docx';
    const buf = docx ? await this.pack.finalPackDocx(st, report) : await this.pack.finalPackPdf(st, report);
    await this.trace.record('tool', 'build_final_pack', { format: docx ? 'docx' : 'pdf', bytes: buf.length }, { applicantId: id });
    send(res, buf, `Educaro-final-pack-${st.applicant.name.replace(/\s+/g, '-')}.${docx ? 'docx' : 'pdf'}`, docx);
  }

  @Get('applicants/:id/lebenslauf')
  async lebenslauf(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('format') format: string, @Res() res: Response) {
    assertAccess(u, id);
    const st = await this.state.load(id);
    const docx = format === 'docx';
    const buf = docx ? await this.pack.lebenslaufDocx(st) : await this.pack.lebenslaufPdf(st);
    await this.trace.record('tool', 'generate_resume', { format: docx ? 'docx' : 'pdf' }, { applicantId: id });
    send(res, buf, `Lebenslauf-${st.applicant.name.replace(/\s+/g, '-')}.${docx ? 'docx' : 'pdf'}`, docx);
  }

  @Get('applicants/:id/emails')
  async emails(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    assertAccess(u, id);
    const rows = await db.query.emails.findMany({ where: eq(schema.emails.applicantId, id), orderBy: asc(schema.emails.createdAt) });
    return rows.map(toEmailDTO);
  }

  @Get('applicants/:id/calendar')
  async cal(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    assertAccess(u, id);
    const rows = await db.query.calendarEvents.findMany({ where: eq(schema.calendarEvents.applicantId, id), orderBy: asc(schema.calendarEvents.startsAt) });
    return rows.map(toCalendarDTO);
  }

  @Get('calendar/:eid/ics')
  async ics(@CurrentUser() u: AuthUser, @Param('eid') eid: string, @Res() res: Response) {
    const e = await db.query.calendarEvents.findFirst({ where: eq(schema.calendarEvents.id, eid) });
    if (!e) throw new NotFoundException();
    assertAccess(u, e.applicantId);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${e.title.replace(/[^a-z0-9]+/gi, '-')}.ics"`);
    res.send(this.calendar.ics(e));
  }

  // ---------- interview coach ----------
  @Post('applicants/:id/interview')
  async startInterview(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: { kind: InterviewDTO['kind'] }): Promise<InterviewDTO> {
    assertAccess(u, id);
    return this.interview.start(id, b?.kind ?? 'employer');
  }

  @Post('interview/:sid/answer')
  async interviewAnswer(@CurrentUser() u: AuthUser, @Param('sid') sid: string, @Body() b: { text: string }): Promise<InterviewDTO> {
    const s = await db.query.interviewSessions.findFirst({ where: eq(schema.interviewSessions.id, sid) });
    if (!s) throw new NotFoundException();
    assertAccess(u, s.applicantId);
    return this.interview.answer(sid, String(b?.text ?? ''));
  }

  // ---------- Discord link ----------
  @Post('applicants/:id/discord-link')
  async discordLink(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    assertAccess(u, id);
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    await db.update(schema.applicants).set({ cohortChannel: null }).where(eq(schema.applicants.id, id));
    await this.q.redis.set(`discord:link:${code}`, id, 'EX', 3600);
    return { code };
  }

  // ---------- Germany mode ----------
  @Post('applicants/:id/germany')
  async germany(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: { city: string; address?: string; startDate?: string }) {
    assertAccess(u, id);
    if (!b?.city) throw new BadRequestException('City is required');
    await this.state.touch(id, { mode: 'germany', targetCity: b.city, germanyAddress: b.address ?? null, startDate: b.startDate ?? null, stage: 'arrived', stageReason: 'Visa granted; Germany mode is on' });
    await this.trace.record('event', 'visa_granted', { city: b.city }, { applicantId: id });
    await this.events.wake(id, { type: 'visa_granted', detail: { city: b.city } });
    return toApplicantDTO(await this.state.applicant(id));
  }
}

function send(res: Response, buf: Buffer, filename: string, docx: boolean) {
  res.setHeader('Content-Type', docx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}
