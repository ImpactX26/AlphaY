import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/db';
import { StateService, type ApplicantState } from '../agent/state.service';
import { WebService } from '../web/web.service';
import { TraceService } from '../trace/trace.service';
import { GuardsService } from '../agent/guards.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ChatService } from '../profile/chat.service';
import { PackService } from './pack.service';
import { MailService } from './mail.service';
import { keywordsFromPage, matchKeywords, type TailorReport } from '../knowledge/keywords';

/**
 * A CV written for one university, and the email that carries it.
 *
 * This is the most useful thing the product can do with documents it already holds, and the easiest
 * place to start lying. A model asked to "tailor this CV for the role" will happily produce a CV
 * describing somebody who does not exist — and the person who has to defend it is an applicant
 * sitting an interview in their third language.
 *
 * So the tailoring is selection and ordering, never addition:
 *
 * - The requirements come from the target's own page, opened in this run and parsed in code.
 * - The skills come from the applicant's own documents and statements.
 * - A keyword the page wants and the applicant cannot evidence appears in the gap report shown to
 *   them. It never appears on the CV.
 *
 * What changes between one target's CV and another's is which true things lead, and a profile line
 * naming the overlap. That is what a good human adviser does, and it is defensible line by line.
 */
@Injectable()
export class TailorService {
  private readonly log = new Logger('Tailor');

  constructor(
    private readonly state: StateService,
    private readonly web: WebService,
    private readonly pack: PackService,
    private readonly mail: MailService,
    private readonly chat: ChatService,
    private readonly rt: RealtimeGateway,
    private readonly trace: TraceService,
    private readonly guards: GuardsService,
  ) {}

  /**
   * Everything this applicant can actually show, as searchable evidence.
   *
   * Document text first, because a skill named in a transcript or an experience letter is one a
   * reader can verify; stated facts second. Nothing from a CV the applicant wrote themselves is
   * treated as verified — that would be circular, since the CV is what we are rewriting.
   */
  private evidenceFor(st: ApplicantState): { text: string; label: string; tag: 'verified' | 'said'; factId?: string }[] {
    const out: { text: string; label: string; tag: 'verified' | 'said'; factId?: string }[] = [];
    for (const f of st.files) {
      if (!f.text || f.status !== 'done') continue;
      const fromTheirOwnCv = f.kind === 'cv';
      // A document is traced through the facts it produced, so a sentence on the letter can name a
      // row in the truth map rather than a filename.
      const fromThisFile = st.facts.find((x) => x.sourceRef === f.id);
      out.push({ text: f.text, label: f.kindLabel ?? f.originalName, tag: fromTheirOwnCv ? 'said' : 'verified', factId: fromThisFile?.id });
    }
    for (const f of st.facts) {
      if (f.tag !== 'verified' && f.tag !== 'said') continue;
      out.push({ text: `${f.label} ${f.value}`, label: f.label, tag: f.tag, factId: f.id });
    }
    return out;
  }

  /**
   * Read the target's page and work out how well this applicant matches it.
   *
   * The page is opened every time rather than read from the catalogue: a stored keyword list is a
   * snapshot of what somebody wanted last year, and the watcher exists precisely because these
   * pages move.
   */
  async report(applicantId: string, shortlistId: string): Promise<TailorReport & { url: string | null; pageOpened: boolean }> {
    const st = await this.state.load(applicantId);
    const target = st.shortlist.find((s) => s.id === shortlistId);
    if (!target) throw new NotFoundException('That is not on your shortlist');

    const runId = `tailor_${Date.now().toString(36)}`;
    const page = target.url ? await this.web.fetchPage(target.url, { runId, applicantId }).catch(() => null) : null;

    // With no page we still produce a report, from whatever the catalogue holds, and say the page
    // was not opened — silently falling back would make a stale list look like a live reading.
    const text = page?.text ?? [target.title, target.subtitle, JSON.stringify(target.requirements ?? {})].join(' ');
    const wanted = keywordsFromPage(text);
    const report = matchKeywords(target.title, wanted, this.evidenceFor(st));

    await this.trace.record(
      'tool',
      'tailor_report',
      { target: target.title, url: target.url, pageOpened: Boolean(page), wanted: wanted.length, matched: report.matched },
      { applicantId, runId },
    );
    return { ...report, url: target.url || null, pageOpened: Boolean(page) };
  }

  /**
   * Build the tailored CV and put the email in front of a human.
   *
   * Nothing is sent here. The approval is the only thing that sends, because the guard that matters
   * most in this product is that nothing leaves without somebody tapping it — and this one carries
   * an attachment with their name on it to an address they will be judged by.
   */
  async draft(applicantId: string, input: { shortlistId: string; to?: string; subject?: string; note?: string }) {
    const st = await this.state.load(applicantId);
    const target = st.shortlist.find((s) => s.id === input.shortlistId);
    if (!target) throw new NotFoundException('That is not on your shortlist');

    const to = (input.to ?? '').trim();
    if (to && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new BadRequestException('That does not look like an email address.');

    const runId = `tailor_${Date.now().toString(36)}`;
    const report = await this.report(applicantId, input.shortlistId);
    const cv = await this.pack.lebenslaufPdf(st, { target: target.title, report });

    const file = await this.pack.store(applicantId, `Lebenslauf-${slug(target.title)}.pdf`, cv);
    const strongest = report.matches.filter((m) => m.have).slice(0, 4).map((m) => m.term);
    const metRequired = report.matches.filter((m) => m.have && m.weight === 'required').slice(0, 3);

    // Named lines rather than an anonymous array, because each one is referenced again below when
    // the sentences are tied to the facts that back them.
    const lines = {
      intro: `my name is ${st.applicant.name} and I am applying to ${target.title}${target.subtitle ? ` (${target.subtitle})` : ''}.`,
      // Name the requirements they actually meet, not the first three on the page. The first cut
      // listed the required terms regardless, so the letter opened by naming the three things the
      // applicant cannot do and then changed the subject.
      claim: metRequired.length
        ? `Your page asks for ${metRequired.map((m) => m.term.toLowerCase()).join(', ')}, and my attached Lebenslauf documents ${metRequired.length === 1 ? 'it' : 'each of them'} — ${metRequired.map((m) => m.evidence).filter(Boolean).slice(0, 2).join(' and ')} rather than asserted on a CV.`
        : strongest.length
          ? `My attached Lebenslauf documents ${strongest.join(', ')}, each backed by a certificate or an employer letter rather than asserted.`
          : `My attached Lebenslauf sets out my qualifications and experience, each backed by a certificate or an employer letter.`,
    };

    const body = [
      'Sehr geehrte Damen und Herren,',
      '',
      lines.intro,
      lines.claim,
      input.note?.trim() ?? '',
      '',
      'I would be glad to provide any further document you need.',
      '',
      'Mit freundlichen Grüßen,',
      st.applicant.name,
    ].join('\n');

    /**
     * The same guarantee the writer's letters carry: every sentence names the facts behind it.
     *
     * Without this the tailored letter was a free-text body that happened to be true, and the guard
     * that refuses claims with no source never ran over it — the smoke suite caught exactly that.
     * A letter this product sends has to be defensible sentence by sentence, whichever code wrote it.
     */
    const factIdsFor = (terms: string[]) =>
      terms
        .map((t) => report.matches.find((m) => m.term === t)?.factId)
        .filter((x): x is string => Boolean(x));

    const sentences = [
      { text: lines.intro, keywords: [] as string[], factIds: [] as string[] },
      { text: lines.claim, keywords: strongest, factIds: factIdsFor(strongest) },
      ...(input.note?.trim() ? [{ text: input.note.trim(), keywords: [], factIds: [] }] : []),
      { text: 'I would be glad to provide any further document you need.', keywords: [], factIds: [] },
    ];
    await this.guards.assertWriterRefs({ applicantId, runId }, sentences.flatMap((x) => x.factIds));

    const [approval] = await db
      .insert(schema.approvals)
      .values({
        applicantId,
        kind: 'email',
        title: `Application with a tailored CV: ${target.title}`,
        payload: {
          sentences,
          // Marks this as the tailored artifact, so the letter drafter does not mistake it for one
          // of its own and hand it back instead of writing a motivation letter.
          variant: 'tailored-cv',
          to,
          cc: st.applicant.email ? [st.applicant.email] : [],
          replyTo: this.mail.replyAddress(applicantId),
          subject: input.subject?.trim() || `Application — ${target.title} — ${st.applicant.name}`,
          body,
          keywords: report.matches.filter((m) => m.have).map((m) => m.term),
          attachments: [{ name: `Lebenslauf-${slug(target.title)}.pdf`, fileId: file.id }],
          targetUrl: report.url,
          shortlistId: input.shortlistId,
          mode: to ? 'email' : 'portal',
          tailor: report,
          by: 'agent',
        } as unknown as Record<string, unknown>,
        needsApplicant: true,
        needsStaff: st.applicant.staffSecondKey,
      })
      .returning();

    await this.chat.agentSays(
      applicantId,
      report.requiredMatched < report.required
        ? `I have written a Lebenslauf for ${target.title} and an email to go with it — it is waiting for you to read before anything is sent. One thing to know first: their page asks for ${report.required} things and your documents evidence ${report.requiredMatched} of them. I have not written the others onto your CV, because you would have to defend them in an interview. ${report.missing.slice(0, 2).map((m) => m.term).join(' and ')} ${report.missing.length === 1 ? 'is' : 'are'} what would close the gap.`
        : `I have written a Lebenslauf for ${target.title}, led with the things their page actually asks for, and drafted the email. Everything on it is backed by a document you have given me. Read it and send it when you are happy — nothing leaves until you tap it.`,
    );

    await this.trace.record('approval', 'request_approval', { approvalId: approval.id, title: approval.title, matched: report.matched, of: report.matches.length }, { applicantId, runId });
    this.rt.toBoth(applicantId, { type: 'refresh', applicantId, what: ['approvals', 'chat'] });
    // Say plainly where this will actually land. Safe mode redirects any address that is not
    // allowlisted to the team inbox, which is right for a prototype and catastrophic to be unaware
    // of: somebody would believe they had applied to RWTH.
    const delivery = this.mail.safeRecipients(to ? [to] : []);
    return {
      approvalId: approval.id,
      report,
      cvFileId: file.id,
      to,
      /** False when safe mode will redirect it to the demo inbox instead of the address typed. */
      willSendAsTyped: Boolean(to) && !delivery.redirected,
      actualRecipients: delivery.to,
    };
  }
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
