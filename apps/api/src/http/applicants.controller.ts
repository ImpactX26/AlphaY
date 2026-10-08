import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import type { ApplicantDTO, ChatMessageDTO, FactDTO, FileDTO, QuestionDTO, Screen, TranscriptDTO, TruthRow } from '@educaro/shared';
import { Route } from '@educaro/shared';
import { and, asc, desc, eq } from 'drizzle-orm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config';
import { db, schema } from '../db/db';
import { type AuthUser } from '../auth/jwt';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { assertCanSee, CurrentUser } from './auth.guard';
import { toApplicant, toChat, toFact, toFile, toQuestion, toScreen } from './map';

/**
 * Applicant-scoped reads, uploads and chat. Thin by design: validate, touch the DB,
 * map to the contract DTO, tell the room. All reasoning lives in Claude A's services.
 */
@Controller('applicants')
export class ApplicantsController {
  constructor(private readonly realtime: RealtimeGateway) {}

  @Get(':id')
  async applicant(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ApplicantDTO> {
    assertCanSee(user, id);
    return toApplicant(await this.row(id));
  }

  /** Empty blocks + the applicant's own mode for a new applicant, never a 404. */
  @Get(':id/screen')
  async screen(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<Screen> {
    assertCanSee(user, id);
    const applicant = await this.row(id);
    const [stored] = await db.select().from(schema.screens).where(eq(schema.screens.applicantId, id)).limit(1);
    return toScreen(id, stored, applicant);
  }

  @Get(':id/files')
  async files(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<FileDTO[]> {
    assertCanSee(user, id);
    const rows = await db.select().from(schema.files).where(eq(schema.files.applicantId, id)).orderBy(asc(schema.files.createdAt));
    return rows.map(toFile);
  }

  @Post(':id/video')
  @UseInterceptors(FileInterceptor('video'))
  async uploadVideo(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<FileDTO> {
    assertCanSee(user, id);
    if (!file) throw new BadRequestException('No video came through. Try again.');
    const [saved] = await this.store(id, [file], 'story_video');
    return saved;
  }

  @Post(':id/files')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'files', maxCount: 25 }]))
  async uploadFiles(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFiles() files: { files?: Express.Multer.File[] } | undefined,
  ): Promise<FileDTO[]> {
    assertCanSee(user, id);
    const list = files?.files ?? [];
    if (!list.length) throw new BadRequestException('No files came through. Try again.');
    return this.store(id, list, 'other');
  }

  @Get(':id/transcript')
  async transcript(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<TranscriptDTO | null> {
    assertCanSee(user, id);
    const [row] = await db
      .select()
      .from(schema.files)
      .where(and(eq(schema.files.applicantId, id), eq(schema.files.kind, 'story_video')))
      .orderBy(desc(schema.files.createdAt))
      .limit(1);
    if (!row?.text) return null;
    const extracted = (row.extracted ?? {}) as { segments?: TranscriptDTO['segments']; provider?: string };
    return { fileId: row.id, text: row.text, segments: extracted.segments ?? [], provider: extracted.provider ?? 'unknown' };
  }

  @Get(':id/facts')
  async facts(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<FactDTO[]> {
    assertCanSee(user, id);
    const rows = await db.select().from(schema.facts).where(eq(schema.facts.applicantId, id)).orderBy(asc(schema.facts.label));
    return rows.map(toFact);
  }

  /** The truth map is computed by A's service; until it lands this stays empty rather than wrong. */
  @Get(':id/truth-map')
  async truthMap(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<TruthRow[]> {
    assertCanSee(user, id);
    await this.row(id);
    return [];
  }

  @Get(':id/questions')
  async questions(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<QuestionDTO[]> {
    assertCanSee(user, id);
    const rows = await db.select().from(schema.questions).where(eq(schema.questions.applicantId, id));
    // Open questions first, newest last, so the web app can take the first two.
    const rank = (s: string) => (s === 'open' ? 0 : 1);
    return rows
      .sort((a, b) => rank(a.status) - rank(b.status) || a.createdAt.getTime() - b.createdAt.getTime())
      .map(toQuestion);
  }

  @Get(':id/chat')
  async chat(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ChatMessageDTO[]> {
    assertCanSee(user, id);
    const rows = await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.applicantId, id)).orderBy(asc(schema.chatMessages.createdAt));
    return rows.map(toChat);
  }

  /** Stores the message and tells the room. The agent's reply arrives later, over the socket. */
  @Post(':id/chat')
  async sendChat(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { text?: string }): Promise<ChatMessageDTO> {
    assertCanSee(user, id);
    const text = body.text?.trim();
    if (!text) throw new BadRequestException('Write something first.');
    await this.row(id);

    const [row] = await db
      .insert(schema.chatMessages)
      .values({ applicantId: id, author: user.role === 'staff' ? 'staff' : 'applicant', channel: 'web', text })
      .returning();
    const msg = toChat(row);
    this.realtime.toBoth(id, { type: 'chat', applicantId: id, message: msg });
    return msg;
  }

  @Post(':id/route')
  async setRoute(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { route?: string }): Promise<ApplicantDTO> {
    assertCanSee(user, id);
    const parsed = Route.safeParse(body.route);
    if (!parsed.success) throw new BadRequestException('That is not one of the routes offered.');
    const [row] = await db
      .update(schema.applicants)
      .set({ route: parsed.data, updatedAt: new Date() })
      .where(eq(schema.applicants.id, id))
      .returning();
    if (!row) throw new NotFoundException('No such applicant.');
    const dto = toApplicant(row);
    this.realtime.toBoth(id, { type: 'refresh', applicantId: id, what: ['applicant'] });
    return dto;
  }

  /** Writes the bytes to disk, records the row as `queued`, and lets the room know. */
  private async store(applicantId: string, files: Express.Multer.File[], kind: string): Promise<FileDTO[]> {
    await this.row(applicantId);
    const dir = path.join(config.storageDir, applicantId);
    fs.mkdirSync(dir, { recursive: true });

    const out: FileDTO[] = [];
    for (const f of files) {
      const safe = path.basename(f.originalname).replace(/[^\w.\-]+/g, '_');
      const abs = path.join(dir, `${randomUUID()}-${safe}`);
      fs.writeFileSync(abs, f.buffer);
      const [row] = await db
        .insert(schema.files)
        .values({
          applicantId,
          originalName: f.originalname,
          mime: f.mimetype || 'application/octet-stream',
          size: f.size,
          storagePath: abs,
          kind,
          status: 'queued',
        })
        .returning();
      out.push(toFile(row));
    }
    // A's ingest queue picks these up; the web app already polls while anything is queued.
    this.realtime.toBoth(applicantId, { type: 'refresh', applicantId, what: ['files'] });
    return out;
  }

  private async row(id: string) {
    const [row] = await db.select().from(schema.applicants).where(eq(schema.applicants.id, id)).limit(1);
    if (!row) throw new NotFoundException('No such applicant.');
    return row;
  }
}
