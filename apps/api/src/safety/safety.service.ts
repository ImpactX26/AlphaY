import { Injectable, Logger } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../db/db';
import { WebService } from '../web/web.service';
import { TraceService } from '../trace/trace.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ChatService } from '../profile/chat.service';
import { checkContract, contractKind, feeBeforeContract, missingFromContract, REGISTERS, scamCheck, type ScamInput } from '../knowledge/safety';

export interface CheckRequest {
  kind: ScamInput['kind'];
  name?: string;
  url?: string;
  email?: string;
  /** The offer letter, the message, the contract — whatever they were sent. */
  text?: string;
}

/**
 * "Someone sent me this. Is it real?"
 *
 * This is the question applicants ask friends on WhatsApp at midnight, and the answer they get is a
 * guess from somebody equally far away. The checks that actually settle it are cheap, and the
 * reason nobody runs them is that nobody tells you which ones matter.
 *
 * When there is a URL the agent opens it, so the verdict is based on a page that really exists and
 * really says what the message claims. Every check is kept, because the same fake agent turns up in
 * six inboxes and staff should see the pattern.
 */
@Injectable()
export class SafetyService {
  private readonly log = new Logger('Safety');

  constructor(
    private readonly web: WebService,
    private readonly chat: ChatService,
    private readonly rt: RealtimeGateway,
    private readonly trace: TraceService,
  ) {}

  async check(applicantId: string | null, req: CheckRequest) {
    const runId = `check_${Date.now().toString(36)}`;
    const ctx = { runId, applicantId };

    let pageOpened = false;
    let pageText = '';
    if (req.url) {
      const page = await this.web.fetchPage(req.url, ctx).catch(() => null);
      pageOpened = Boolean(page);
      pageText = page?.text?.slice(0, 20_000) ?? '';
    }

    // A known programme in our own catalogue is the strongest signal we hold.
    const known = req.url ? await db.query.programmes.findFirst({ where: eq(schema.programmes.url, req.url) }) : null;

    const haystack = `${req.text ?? ''}\n${pageText}`;
    const result = scamCheck({
      kind: req.kind,
      name: req.name || known?.title || req.url || 'this',
      url: req.url ?? null,
      email: req.email ?? null,
      text: haystack,
      pageOpened,
      inCatalogue: Boolean(known),
      // `security deposit` used to be in this list, so every lawful rental was read as a scam fee.
      // The rule now lives with the other patterns and only counts a deposit demanded before a
      // contract or a viewing. See `feeBeforeContract`.
      feeRequested: feeBeforeContract(haystack),
    });

    // The contract check reads what they were sent, not the website. A company's own careers page
    // is not a contract, and running the clause rules over it would invent findings.
    const kind = req.text ? contractKind(req.text) : 'unknown';
    const contractFlags = req.text ? checkContract(req.text, kind) : [];
    const missing = req.text ? missingFromContract(req.text, kind) : [];

    const [row] = await db
      .insert(schema.safetyChecks)
      .values({
        applicantId,
        kind: req.kind,
        subject: req.name || known?.title || req.url || 'unnamed',
        url: req.url ?? null,
        verdict: result.verdict,
        score: result.score,
        signals: result.signals as unknown as Record<string, unknown>[],
        contractFlags: contractFlags as unknown as Record<string, unknown>[],
        contractKind: kind,
        missing: missing as unknown as Record<string, unknown>[],
        excerpt: req.text ? req.text.slice(0, 2_000) : null,
      })
      .returning();

    // An illegal clause outranks a clean-looking sender. A real hospital can send a loaded contract,
    // and "the employer checks out" is exactly the wrong headline to put above eight void clauses.
    const illegal = contractFlags.filter((f) => f.severity === 'illegal').length;
    const verdict: typeof result.verdict = illegal >= 3 ? 'high_risk' : illegal >= 1 && result.verdict === 'looks_legitimate' ? 'be_careful' : result.verdict;

    await this.trace.record('guard', 'safety_check', { kind: req.kind, verdict: result.verdict, score: result.score, flags: contractFlags.length }, ctx);

    if (applicantId && (verdict === 'high_risk' || illegal > 0)) {
      await this.chat.agentSays(
        applicantId,
        result.verdict === 'high_risk'
          ? `I would not send anything to ${row.subject} yet. ${result.signals.find((s) => s.status === 'bad')?.detail ?? ''} Let's go through it with a consultant before any money or documents leave.`
          : `I read that contract. ${illegal} clause${illegal === 1 ? '' : 's'} in it ${illegal === 1 ? 'is' : 'are'} not enforceable in Germany, whatever it says — the details are on your screen, each with the law behind it. Please do not sign it today.`,
      );
    }

    return {
      id: row.id,
      subject: { kind: req.kind, name: row.subject },
      verdict,
      score: result.score,
      signals: result.signals,
      contractFlags,
      contractKind: kind,
      missing,
      neverDo: result.neverDo,
      registers: Object.values(REGISTERS),
      pageOpened,
      checkedAt: row.createdAt.toISOString(),
    };
  }

  async history(applicantId: string) {
    const rows = await db.select().from(schema.safetyChecks).where(eq(schema.safetyChecks.applicantId, applicantId)).orderBy(desc(schema.safetyChecks.createdAt)).limit(20);
    return rows.map((r) => ({ id: r.id, kind: r.kind, subject: r.subject, verdict: r.verdict, score: r.score, createdAt: r.createdAt.toISOString() }));
  }

  // ---------------------------------------------------------------- private reports

  async report(applicantId: string, input: { employer: string; text: string; category?: string; severity?: string }) {
    const [row] = await db
      .insert(schema.employerReports)
      .values({
        applicantId,
        employer: input.employer.trim(),
        category: (input.category as any) ?? 'other',
        severity: (input.severity as any) ?? 'concern',
        text: input.text.trim(),
      })
      .returning();

    // Staff see it immediately. The applicant is never named to the employer.
    this.rt.toStaff({ type: 'refresh', applicantId, what: ['reports'] });
    await this.trace.record('event', 'employer_report', { employer: row.employer, category: row.category, severity: row.severity }, { applicantId });
    await this.chat.agentSays(
      applicantId,
      'Thank you for telling me. That stays between you and Educaro — your employer will never see it or know it came from you. A consultant will read it today, and it changes how we rate that employer for everyone who comes after you.',
    );
    return { id: row.id, status: row.status, createdAt: row.createdAt.toISOString() };
  }

  /**
   * The rating, built only from the aggregate.
   *
   * One report is a person's experience and is not a rating. Three reports about hours from three
   * different people is a fact about the employer, and the people who come after deserve it.
   */
  async employerRatings() {
    const reports = await db.select().from(schema.employerReports);
    const openings = await db.select().from(schema.openings);

    // Group on a normalised key, not the raw string. "Klinikum Köln-Mitte" typed three ways —
    // umlaut, no umlaut, extra GmbH — is one employer, and splitting its rating three ways is how a
    // pattern disappears exactly when it matters.
    const byEmployer = new Map<string, typeof reports>();
    for (const r of reports) {
      const k = employerKey(r.employer);
      byEmployer.set(k, [...(byEmployer.get(k) ?? []), r]);
    }
    // The name an opening uses is the canonical one; a report's spelling is whatever was typed.
    const display = new Map<string, string>();
    for (const r of reports) display.set(employerKey(r.employer), r.employer);
    for (const o of openings) display.set(employerKey(o.employer), o.employer);

    const keys = new Set([...byEmployer.keys(), ...openings.map((o) => employerKey(o.employer))]);
    return [...keys]
      .map((key) => {
        const employer = display.get(key) ?? key;
        const rs = byEmployer.get(key) ?? [];
        const serious = rs.filter((r) => r.severity === 'serious').length;
        const concerns = rs.filter((r) => r.severity === 'concern').length;
        // Starts neutral at 4 and only moves on evidence.
        const rating = Math.max(1, Math.min(5, 4 - serious * 1.5 - concerns * 0.5));
        const themes = [...new Set(rs.map((r) => r.category))];
        return {
          employer,
          rating: Math.round(rating * 10) / 10,
          reports: rs.length,
          serious,
          themes,
          // Below three, say so rather than publishing a rating built on one bad week.
          confident: rs.length >= 3,
          latest: rs.sort((a, b) => +b.createdAt - +a.createdAt)[0]?.createdAt.toISOString() ?? null,
        };
      })
      .sort((a, b) => b.reports - a.reports || a.employer.localeCompare(b.employer));
  }

  async reportsFor(employer?: string) {
    const rows = await db.select().from(schema.employerReports).orderBy(desc(schema.employerReports.createdAt));
    const filtered = employer ? rows.filter((r) => employerKey(r.employer) === employerKey(employer)) : rows;
    const applicants = await db.select().from(schema.applicants);
    const names = new Map(applicants.map((a) => [a.id, a.name]));
    return filtered.map((r) => ({
      id: r.id,
      employer: r.employer,
      category: r.category,
      severity: r.severity,
      text: r.text,
      status: r.status,
      // Staff see who it was, because they have to act on it. The employer never does.
      applicantName: r.applicantId ? names.get(r.applicantId) ?? null : null,
      applicantId: r.applicantId,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

/**
 * One employer, however it was typed. Diacritics folded, legal forms and punctuation dropped, so
 * "Klinikum Köln-Mitte", "Klinikum Koeln Mitte GmbH" and "klinikum koln-mitte" are the same place.
 */
export function employerKey(name: string): string {
  return (
    (name ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      // German transliterates its own umlauts both ways and both turn up in the same inbox:
      // "Köln" and "Koeln" are one city, whatever the keyboard of the person typing was set to.
      .replace(/oe/g, 'o')
      .replace(/ue/g, 'u')
      .replace(/ae/g, 'a')
      // Punctuation first, so "e.V." is already "e v" by the time legal forms are stripped.
      // Stripping them before this ran was why none of them ever matched.
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(gmbh|mbh|ggmbh|ag|kg|e\s?v|co|ltd|inc|plc)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

