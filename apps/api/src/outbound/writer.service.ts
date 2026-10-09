import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { LetterPayload } from '@educaro/shared';
import { db, schema } from '../db/db';
import { LlmService } from '../llm/llm.service';
import { GuardsService } from '../agent/guards.service';
import { SkillsService } from '../agent/skills.service';
import { StateService, bestFact, type ApplicantState } from '../agent/state.service';
import { TraceService } from '../trace/trace.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MailService } from './mail.service';

const Letter = z.object({
  subject: z.string(),
  greeting: z.string(),
  sentences: z.array(z.object({ text: z.string(), factIds: z.array(z.string()), keywords: z.array(z.string()) })),
  closing: z.string(),
});
type Letter = z.infer<typeof Letter>;

const SYSTEM = `You are Educaro's writer. You draft one application letter for an applicant.
Use ONLY the numbered facts given (they are Verified or You-said). Never invent experience, grades, dates or skills.
Every sentence lists the fact ids it relies on in "factIds" (empty only for purely polite sentences).
Weave in the target's own keywords where they are true for this applicant, and list the ones used per sentence in "keywords".
6 to 10 sentences, warm and specific, no clichés, no exaggeration. English. No markdown.`;

/** Writer specialist: letters and CVs built only from Verified and You-said facts (guard 3). */
@Injectable()
export class WriterService {
  constructor(
    private readonly llm: LlmService,
    private readonly guards: GuardsService,
    private readonly skills: SkillsService,
    private readonly state: StateService,
    private readonly trace: TraceService,
    private readonly rt: RealtimeGateway,
    private readonly mail: MailService,
  ) {}

  writerFacts(st: ApplicantState) {
    return this.guards
      .writerFacts(st.facts)
      .filter((f) => !(f.data as any)?.sensitive && !f.key.startsWith('contact.') && !f.key.startsWith('identity.passport') && !f.key.startsWith('identity.dob') && !f.key.startsWith('answer.'));
  }

  async draftApplication(applicantId: string, shortlistId: string, runId: string) {
    const st = await this.state.load(applicantId);
    const target = st.shortlist.find((s) => s.id === shortlistId);
    if (!target) return null;
    // Only reuse a letter this writer produced.
    //
    // The tailored-CV flow also creates an email approval against the same shortlist row, and
    // handing that back instead of writing a motivation letter returned an artifact with no
    // sentence-level sources — a different promise entirely. Tested structurally rather than by a
    // marker field: a letter is a thing with sentences, and that holds for rows written before any
    // marker existed.
    const isLetter = (a: (typeof st.approvals)[number]) => Array.isArray((a.payload as any)?.sentences) && (a.payload as any).sentences.length > 0;
    const existing = st.approvals.find((a) => a.kind === 'email' && (a.payload as any).shortlistId === shortlistId && isLetter(a) && a.status !== 'rejected');
    if (existing) return existing;

    let keywords: string[] = [];
    let to: string | null = null;
    let targetName = target.title;
    if (target.kind === 'opening' && target.refId) {
      const o = await db.query.openings.findFirst({ where: eq(schema.openings.id, target.refId) });
      keywords = o?.keywords ?? [];
      to = o?.employerEmail ?? null;
      targetName = `${o?.title} at ${o?.employer}`;
    } else {
      keywords = ((target.requirements as any)?.keywords as string[]) ?? [];
      if (!keywords.length && target.refId) {
        const p = await db.query.programmes.findFirst({ where: eq(schema.programmes.id, target.refId) });
        keywords = ((p?.data as any)?.keywords as string[]) ?? [];
      }
    }
    const facts = this.writerFacts(st);
    const ids = new Map(facts.map((f, i) => [`f${i + 1}`, f]));
    const skill = await this.skills.load('letters-de');
    const user = [
      `TARGET: ${targetName} (${target.kind === 'opening' ? 'job application (Bewerbung) to an employer' : 'motivation letter for a university programme'})`,
      `TARGET KEYWORDS (from their own page): ${keywords.join(', ') || 'none'}`,
      `APPLICANT FIRST NAME: ${st.applicant.name.split(' ')[0]}`,
      `FACTS:\n${[...ids].map(([id, f]) => `${id}: ${f.label}: ${f.value} [${f.tag}]`).join('\n')}`,
      skill ? `STYLE GUIDE:\n${skill.slice(0, 1500)}` : '',
    ].join('\n\n');
    let letter = await this.llm.json({ task: 'draft_letter', tier: 'quality', system: SYSTEM, user, schema: Letter, applicantId, runId, maxTokens: 3000 });
    let by = 'agent';
    if (!letter) {
      letter = templateLetter(st, targetName, keywords, ids);
      by = 'rules';
    }
    // Guard 3: map short ids back, drop anything that is not a real Verified / You-said fact.
    const sentences = letter.sentences.map((s) => ({
      text: s.text,
      keywords: s.keywords.filter((k) => keywords.some((x) => x.toLowerCase() === k.toLowerCase()) || s.text.toLowerCase().includes(k.toLowerCase())),
      factIds: s.factIds.map((id) => ids.get(id)?.id).filter(Boolean) as string[],
    }));
    await this.guards.assertWriterRefs({ applicantId, runId }, sentences.flatMap((s) => s.factIds));
    const name = st.applicant.name;
    const body = `${letter.greeting}\n\n${sentences.map((s) => s.text).join(' ')}\n\n${letter.closing}\n${name}`;
    const payload: LetterPayload & { shortlistId: string; mode: 'email' | 'portal'; by: string } = {
      to: to ?? '',
      cc: st.applicant.email ? [st.applicant.email] : [],
      replyTo: this.mail.replyAddress(applicantId),
      subject: letter.subject,
      body,
      sentences,
      keywords,
      attachments: [
        { name: 'Lebenslauf.pdf' },
        ...st.files
          .filter((f) => ['degree_certificate', 'diploma_certificate', 'experience_letter', 'language_certificate', 'transcript', 'registration_certificate'].includes(f.kind) && f.status === 'done')
          .map((f) => ({ name: f.originalName, fileId: f.id })),
      ],
      targetUrl: target.url || null,
      shortlistId,
      mode: to ? 'email' : 'portal',
      by,
    };
    const [approval] = await db
      .insert(schema.approvals)
      .values({
        applicantId,
        kind: 'email',
        title: to ? `Application: ${targetName}` : `Motivation letter: ${targetName}`,
        payload: payload as unknown as Record<string, unknown>,
        needsApplicant: true,
        needsStaff: st.applicant.staffSecondKey,
      })
      .returning();
    await this.trace.record('approval', 'request_approval', { approvalId: approval.id, title: approval.title, by, keywords: keywords.length }, { applicantId, runId });
    this.rt.toBoth(applicantId, { type: 'refresh', applicantId, what: ['approvals'] });
    return approval;
  }
}

function templateLetter(st: ApplicantState, targetName: string, keywords: string[], ids: Map<string, { id: string; key: string; label: string; value: string }>): Letter {
  const find = (pred: (k: string) => boolean) => [...ids].find(([, f]) => pred(f.key));
  const qual = find((k) => k === 'education.highest');
  const exp = find((k) => k.startsWith('experience.'));
  const ger = find((k) => k === 'language.german');
  const why = find((k) => k === 'goal.why_germany');
  const s: Letter['sentences'] = [];
  s.push({ text: `I am writing to apply for ${targetName}.`, factIds: [], keywords: [] });
  if (qual) s.push({ text: `I hold a ${qual[1].value}.`, factIds: [qual[0]], keywords: [] });
  if (exp) s.push({ text: `I have worked as ${exp[1].value.replace(/^.*·\s*/, '') || 'a professional'} (${exp[1].value.split(' · ')[0]}) at ${exp[1].label.replace(/^Experience,\s*/, '')}.`, factIds: [exp[0]], keywords: keywords.slice(0, 1) });
  if (why) s.push({ text: `I want to build my career in Germany: ${why[1].value.replace(/\.$/, '')}.`, factIds: [why[0]], keywords: [] });
  if (ger) s.push({ text: `I am learning German (${ger[1].value}) and continue with Educaro's online course.`, factIds: [ger[0]], keywords: [] });
  s.push({ text: 'I would be glad to introduce myself in an interview.', factIds: [], keywords: [] });
  return { subject: `Application: ${targetName}`, greeting: 'Dear Sir or Madam,', sentences: s, closing: 'Kind regards,' };
}

export { bestFact };
