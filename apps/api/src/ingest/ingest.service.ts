import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DOC_KIND_LABEL, type DocKind } from '@educaro/shared';
import { db, schema } from '../db/db';
import { LlmService } from '../llm/llm.service';
import { MediaService } from '../media/media.service';
import { StorageService } from '../storage/storage.service';
import { TraceService } from '../trace/trace.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { QueueService } from '../queue/queue.service';
import { FactsService } from '../profile/facts.service';
import { StateService } from '../agent/state.service';
import { AgentEventsService } from '../agent/events.service';
import { sameOrg, slug } from '../knowledge/normalize';
import { classifyByRules } from './classify';
import {
  CV_SYSTEM,
  CvExtraction,
  DOC_SYSTEM,
  DocExtraction,
  TRANSCRIPT_SYSTEM,
  TranscriptClaims,
  docUserPrompt,
  extractCvByRules,
  extractDocByRules,
  extractTranscriptByRules,
} from './extractors';
import { cvFacts, docFacts, transcriptFacts, type ExpKey } from './to-facts';

type FileRow = typeof schema.files.$inferSelect;

/** Upload → text → sort → read → claims with sources. Rules first; a model only reads what rules cannot. */
@Injectable()
export class IngestService implements OnModuleInit {
  private readonly log = new Logger('Ingest');

  constructor(
    private readonly q: QueueService,
    private readonly llm: LlmService,
    private readonly media: MediaService,
    private readonly storage: StorageService,
    private readonly trace: TraceService,
    private readonly rt: RealtimeGateway,
    private readonly facts: FactsService,
    private readonly state: StateService,
    private readonly events: AgentEventsService,
  ) {}

  onModuleInit() {
    this.q.process<{ fileId: string }, void>('ingest', (job) => this.process(job.data.fileId), 3);
  }

  enqueue(fileId: string) {
    return this.q.add('ingest', 'file', { fileId });
  }

  private async setFile(file: FileRow, patch: Partial<FileRow>) {
    await db.update(schema.files).set(patch).where(eq(schema.files.id, file.id));
    this.rt.toBoth(file.applicantId, { type: 'refresh', applicantId: file.applicantId, what: ['files'] });
  }

  async process(fileId: string): Promise<void> {
    const file = await db.query.files.findFirst({ where: eq(schema.files.id, fileId) });
    if (!file) return;
    const runId = `ingest_${fileId.slice(0, 8)}`;
    await this.setFile(file, { status: 'reading' });
    this.rt.toApplicant(file.applicantId, { type: 'agent_status', applicantId: file.applicantId, status: 'working', detail: `Reading ${file.originalName}` });
    try {
      if (this.media.isVideoOrAudio(file.mime, file.originalName)) await this.video(file, runId);
      else await this.document(file, runId);
    } catch (e: any) {
      this.log.error(`ingest ${file.originalName} failed: ${e?.message}`, e?.stack);
      await this.setFile(file, { status: 'unclear', extracted: { error: String(e?.message ?? e) } });
    }
    await this.events.wake(file.applicantId, { type: 'upload', detail: { fileId } });
  }

  private async expKey(applicantId: string): Promise<ExpKey> {
    const existing = await this.state.experienceKeyResolver(applicantId);
    return (employer: string) => {
      const hit = existing.find((f) => sameOrg(String((f.data as any)?.employer ?? f.label.replace(/^Experience,\s*/, '')), employer));
      return hit ? hit.key : `experience.${slug(employer) || 'job'}`;
    };
  }

  private async document(file: FileRow, runId: string) {
    const abs = this.storage.abs(file.storagePath);
    const { text, method } = await this.media.extractText(abs, file.mime, file.originalName);
    await this.trace.record('tool', 'extract_document', { file: file.originalName, method, chars: text.length }, { applicantId: file.applicantId, runId });
    const guess = classifyByRules(text, file.originalName);
    await this.trace.record('tool', 'classify_upload', { file: file.originalName, kind: guess.kind, confidence: guess.confidence }, { applicantId: file.applicantId, runId });

    if (!text.replace(/\s/g, '').length) {
      await this.setFile(file, {
        kind: guess.kind,
        kindLabel: DOC_KIND_LABEL[guess.kind],
        status: 'unclear',
        confidence: 0,
        extracted: { unclearReason: method === 'pdf-scanned' ? 'Scanned PDF without text. A clear phone photo works better.' : 'No readable text found.' },
      });
      return;
    }

    if (guess.kind === 'cv' && guess.confidence >= 0.55) return this.cv(file, text, runId);

    const llmExt = await this.llm.json({
      task: 'read_document',
      tier: 'cheap',
      system: DOC_SYSTEM,
      user: docUserPrompt(text, file.originalName, guess.kind),
      schema: DocExtraction,
      applicantId: file.applicantId,
      runId,
      maxTokens: 2000,
    });
    if (llmExt?.kind === 'cv') return this.cv(file, text, runId);
    const ext = llmExt ?? extractDocByRules(guess.kind, text);
    const kind = (llmExt ? ext.kind : guess.kind) as DocKind;
    const confidence = llmExt ? Math.min(1, Math.max(0, ext.confidence)) : guess.confidence;
    const unclear = ext.unclear || confidence < 0.45 || kind === 'other';

    const expKey = await this.expKey(file.applicantId);
    const saved = unclear ? [] : await this.facts.saveMany(file.applicantId, docFacts({ ...ext, kind }, file.id, expKey), { runId });
    await this.setFile(file, {
      kind,
      kindLabel: kindLabel(kind, ext),
      confidence,
      status: unclear ? 'unclear' : 'done',
      text: text.slice(0, 20000),
      extracted: { ...ext, passportNumber: ext.passportNumber ? '••••' + ext.passportNumber.slice(-3) : null, method, facts: saved.length },
    });
  }

  private async cv(file: FileRow, text: string, runId: string) {
    const llmCv = await this.llm.json({
      task: 'read_cv',
      tier: 'cheap',
      system: CV_SYSTEM,
      user: text.slice(0, 7000),
      schema: CvExtraction,
      applicantId: file.applicantId,
      runId,
      maxTokens: 2500,
    });
    const cv = llmCv ?? extractCvByRules(text);
    const expKey = await this.expKey(file.applicantId);
    const saved = await this.facts.saveMany(file.applicantId, cvFacts(cv, file.id, expKey), { runId });
    await this.setFile(file, {
      kind: 'cv',
      kindLabel: 'CV',
      confidence: llmCv ? 0.9 : 0.7,
      status: 'done',
      text: text.slice(0, 20000),
      extracted: { ...cv, email: cv.email ? '(hidden)' : null, phone: cv.phone ? '(hidden)' : null, facts: saved.length },
    });
  }

  private async video(file: FileRow, runId: string) {
    const abs = this.storage.abs(file.storagePath);
    const started = Date.now();
    // A seeded persona arrives with its transcript already attached, so a demo does not depend on
    // anyone recording a clip first. Everything after this line is identical either way.
    const seeded = (file.extracted as any)?.seeded && file.text;
    const tr = seeded
      ? { text: file.text as string, provider: 'seed', duration: 0, segments: ((file.extracted as any)?.segments ?? []) as { start: number; end: number; text: string }[] }
      : await this.media.transcribe(abs);
    await this.trace.record(
      'tool',
      'transcribe_media',
      { file: file.originalName, provider: tr.provider, chars: tr.text.length, ms: Date.now() - started },
      { applicantId: file.applicantId, runId },
    );
    const llmClaims = await this.llm.json({
      task: 'read_transcript',
      tier: 'cheap',
      system: TRANSCRIPT_SYSTEM,
      user: tr.text.slice(0, 6000),
      schema: TranscriptClaims,
      applicantId: file.applicantId,
      runId,
      maxTokens: 2000,
    });
    const claims = llmClaims ?? extractTranscriptByRules(tr.text);
    // A quote must really be in the transcript, or it is dropped.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const transcript = norm(tr.text);
    const keep = <T extends { quote: string }>(x: T | null): T | null => (x && x.quote && !transcript.includes(norm(x.quote)) ? { ...x, quote: '' } : x);
    const checked: TranscriptClaims = {
      ...claims,
      education: keep(claims.education),
      germanLevel: keep(claims.germanLevel),
      english: keep(claims.english),
      whyGermany: keep(claims.whyGermany),
      familyInGermany: keep(claims.familyInGermany),
      preferredCity: keep(claims.preferredCity),
      twoYears: keep(claims.twoYears),
      timeline: keep(claims.timeline),
      experience: claims.experience.map((x) => keep(x)!),
    };
    const expKey = await this.expKey(file.applicantId);
    const saved = await this.facts.saveMany(file.applicantId, transcriptFacts(checked, file.id, expKey), { runId });
    await this.setFile(file, {
      kind: 'video',
      kindLabel: 'Intro video',
      confidence: 1,
      status: 'done',
      text: tr.text,
      extracted: { segments: tr.segments, provider: tr.provider, facts: saved.length },
    });
  }
}

function kindLabel(kind: DocKind, e: DocExtraction): string {
  const base = DOC_KIND_LABEL[kind];
  const issuer = e.issuer ?? '';
  const board = issuer.match(/\b(CBSE|ICSE|ISC|Kerala|Maharashtra|Tamil Nadu|Karnataka|State Board)\b/i)?.[1];
  switch (kind) {
    case 'marksheet_12':
    case 'marksheet_10':
      return board ? `${board.toUpperCase() === board ? board : board[0].toUpperCase() + board.slice(1)} ${base.toLowerCase()}` : base;
    case 'experience_letter':
      return e.employer ? `Experience letter · ${e.employer}` : base;
    case 'language_certificate':
      return e.testName ? `${e.testName}${e.level && !e.testName.includes(e.level) ? ` ${e.level}` : ''}` : base;
    case 'degree_certificate':
    case 'diploma_certificate':
      return e.qualification ? `${base} · ${e.qualification}` : base;
    default:
      return base;
  }
}
