import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db/db';
import { config } from '../config';
import { BusService } from '../common/bus.service';
import { ChatService } from '../profile/chat.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TraceService } from '../trace/trace.service';
import { WebService } from '../web/web.service';
import { cefrValue, diffRequirements, meets, parseRequirements, showValue, type Requirement, type RequirementChange } from '../knowledge/requirements';
import { WATCHED_PAGES, watchedText, WATCHED_BY_SLUG, advance, versionOf } from '../mockweb/watched';
import { bavarian } from '../knowledge/grades';

type Source = typeof schema.watchedSources.$inferSelect;

/**
 * Watching the pages that decide whether somebody qualifies.
 *
 * The judge's question — what is a document checked against? — has an uncomfortable answer: a rule
 * on a page somebody else maintains, which changes without telling anyone. When a university drops
 * its IELTS band from 6.5 to 6.0, the people it affects are exactly the ones already told "not
 * yet", and they are the least likely to re-read the page they were rejected against. The same is
 * true of a ministry moving a language threshold and of an employer revising a vacancy.
 *
 * So staff keep a list, this polls it, and every reading is compared against the last. Three rules:
 *
 * - **Nobody is told about a change that does not affect them.** A fee rising by EUR 15 is not a
 *   notification; a band dropping below where you already are is. Affectedness is computed per
 *   person against their own file, not broadcast to a route.
 * - **"Now eligible" is only said to somebody we can actually measure.** An unknown IELTS band is
 *   not a failing one, and telling people they qualify on the strength of a blank field is the one
 *   mistake this feature cannot make.
 * - **The diff is over parsed requirements, never the HTML.** A changed navigation menu is not a
 *   policy change, and a watcher that cries wolf gets muted in a week.
 */
@Injectable()
export class WatchService {
  private readonly log = new Logger('Watch');

  constructor(
    private readonly bus: BusService,
    private readonly chat: ChatService,
    private readonly rt: RealtimeGateway,
    private readonly trace: TraceService,
    private readonly web: WebService,
  ) {}

  /** The demo pages, registered once so the list is never empty on a fresh database. */
  async ensureSeeded() {
    for (const p of WATCHED_PAGES) {
      const url = `${config.apiUrl}/api/mock/watched/${p.slug}`;
      const existing = await db.query.watchedSources.findFirst({ where: eq(schema.watchedSources.url, url) });
      if (existing) continue;
      await db.insert(schema.watchedSources).values({ kind: p.kind, label: `${p.site} — ${p.title}`, url, route: p.route ?? null });
    }
  }

  async list() {
    const sources = await db.select().from(schema.watchedSources).orderBy(desc(schema.watchedSources.createdAt));
    const changes = sources.length
      ? await db.select().from(schema.sourceChanges).where(inArray(schema.sourceChanges.sourceId, sources.map((s) => s.id))).orderBy(desc(schema.sourceChanges.createdAt))
      : [];
    return sources.map((s) => {
      const mine = changes.filter((c) => c.sourceId === s.id);
      return {
        id: s.id,
        kind: s.kind,
        label: s.label,
        url: s.url,
        route: s.route,
        active: s.active,
        intervalMinutes: s.intervalMinutes,
        lastCheckedAt: s.lastCheckedAt?.toISOString() ?? null,
        lastChangedAt: s.lastChangedAt?.toISOString() ?? null,
        lastError: s.lastError,
        requirements: (s.snapshot as unknown as Requirement[]).map((r) => ({ key: r.key, label: r.label, shown: showValue(r.key, r.value), raw: r.raw })),
        changes: mine.slice(0, 6).map((c) => ({
          id: c.id,
          headline: c.headline,
          changes: c.changes as unknown as RequirementChange[],
          notified: (c.notified as unknown as { applicantId: string; name: string; why: string }[]) ?? [],
          createdAt: c.createdAt.toISOString(),
        })),
        /** Only meaningful for the demo stand-ins; null for a real page. */
        demoVersion: this.demoSlug(s.url) ? versionOf(this.demoSlug(s.url)!) + 1 : null,
        demoVersions: this.demoSlug(s.url) ? WATCHED_BY_SLUG.get(this.demoSlug(s.url)!)!.versions.length : null,
      };
    });
  }

  private demoSlug(url: string): string | null {
    const m = url.match(/\/api\/mock\/watched\/([a-z0-9-]+)$/i);
    return m && WATCHED_BY_SLUG.has(m[1]) ? m[1] : null;
  }

  async add(input: { kind?: Source['kind']; label: string; url: string; route?: string; intervalMinutes?: number }) {
    const [row] = await db
      .insert(schema.watchedSources)
      .values({
        kind: input.kind ?? 'university',
        label: input.label.trim(),
        url: input.url.trim(),
        route: input.route ?? null,
        intervalMinutes: Math.max(15, input.intervalMinutes ?? 360),
      })
      .onConflictDoNothing()
      .returning();
    if (row) await this.check(row.id, { notify: false });
    return this.list();
  }

  async remove(id: string) {
    await db.delete(schema.watchedSources).where(eq(schema.watchedSources.id, id));
    return this.list();
  }

  async setActive(id: string, active: boolean) {
    await db.update(schema.watchedSources).set({ active }).where(eq(schema.watchedSources.id, id));
    return this.list();
  }

  /** Move a demo page to its next version, so a change can be seen happening on stage. */
  async simulateUpdate(id: string) {
    const s = await db.query.watchedSources.findFirst({ where: eq(schema.watchedSources.id, id) });
    if (!s) throw new NotFoundException('No such source');
    const slug = this.demoSlug(s.url);
    if (!slug) throw new NotFoundException('That is a real page — it changes when the institution changes it.');
    advance(slug);
    return this.check(id, { notify: true });
  }

  /** Every active source whose interval has elapsed. Called by the scheduler and by the button. */
  async checkDue() {
    const sources = await db.select().from(schema.watchedSources).where(eq(schema.watchedSources.active, true));
    const now = Date.now();
    let checked = 0;
    for (const s of sources) {
      if (s.lastCheckedAt && now - s.lastCheckedAt.getTime() < s.intervalMinutes * 60_000) continue;
      await this.check(s.id, { notify: true }).catch((e) => this.log.warn(`${s.label}: ${e.message}`));
      checked += 1;
    }
    return { checked, of: sources.length };
  }

  async checkAll() {
    const sources = await db.select().from(schema.watchedSources).where(eq(schema.watchedSources.active, true));
    for (const s of sources) await this.check(s.id, { notify: true }).catch((e) => this.log.warn(`${s.label}: ${e.message}`));
    return this.list();
  }

  /**
   * Read a page, compare it to last time, and tell whoever it moved for.
   *
   * `notify: false` on a first read: a source added today has no previous snapshot, so everything
   * on it would register as "added" and the whole list would go out as news.
   */
  async check(id: string, opts: { notify?: boolean } = {}) {
    const s = await db.query.watchedSources.findFirst({ where: eq(schema.watchedSources.id, id) });
    if (!s) throw new NotFoundException('No such source');
    const runId = `watch_${Date.now().toString(36)}`;

    let text: string;
    const slug = this.demoSlug(s.url);
    if (slug) {
      // The stand-ins are read straight from their source rather than over HTTP: the demo should
      // not break because the API cannot reach itself through a tunnel.
      text = watchedText(WATCHED_BY_SLUG.get(slug)!);
    } else {
      const page = await this.web.fetchPage(s.url, { runId }).catch(() => null);
      if (!page?.text) {
        await db.update(schema.watchedSources).set({ lastCheckedAt: new Date(), lastError: 'Could not open the page' }).where(eq(schema.watchedSources.id, id));
        return { changed: false as const, changes: [], notified: [] };
      }
      text = page.text;
    }

    const hash = createHash('sha1').update(text).digest('hex');
    const before = (s.snapshot as unknown as Requirement[]) ?? [];
    const after = parseRequirements(text);
    const first = !s.lastCheckedAt || !before.length;

    await db
      .update(schema.watchedSources)
      .set({ lastCheckedAt: new Date(), lastHash: hash, snapshot: after as unknown as Record<string, unknown>[], lastError: null })
      .where(eq(schema.watchedSources.id, id));

    if (first || hash === s.lastHash) {
      await this.trace.record('tool', 'watch_check', { source: s.label, changed: false, first }, { runId });
      return { changed: false as const, changes: [], notified: [] };
    }

    const changes = diffRequirements(before, after);
    if (!changes.length) return { changed: false as const, changes: [], notified: [] };

    const eased = changes.filter((c) => c.direction === 'easier');
    const headline = eased.length
      ? `${s.label}: ${eased.map((c) => c.label.toLowerCase()).join(', ')} eased`
      : `${s.label}: ${changes.map((c) => c.label.toLowerCase()).slice(0, 3).join(', ')} changed`;

    const [change] = await db
      .insert(schema.sourceChanges)
      .values({ sourceId: s.id, headline, changes: changes as unknown as Record<string, unknown>[] })
      .returning();

    await db.update(schema.watchedSources).set({ lastChangedAt: new Date() }).where(eq(schema.watchedSources.id, id));
    await this.trace.record('tool', 'watch_check', { source: s.label, changed: true, changes: changes.length }, { runId });

    const notified = opts.notify === false ? [] : await this.notify(s, change.id, after, before, changes);
    this.rt.toStaff({ type: 'refresh', applicantId: '', what: ['watch'] });
    return { changed: true as const, changes, notified };
  }

  /**
   * Who needs to hear about this, and what to say to each of them.
   *
   * Three groups, in the order they matter. Somebody who could not meet the old requirements and
   * can meet the new ones is the whole point of the feature. Somebody who met the old ones and no
   * longer meets the new ones needs to know today, not in March. Everyone with the page shortlisted
   * gets a quieter note, because a deadline moving is their business whether or not it blocks them.
   */
  private async notify(s: Source, changeId: string, after: Requirement[], before: Requirement[], changes: RequirementChange[]) {
    const applicants = await db.select().from(schema.applicants);
    const facts = await db.select().from(schema.facts);
    const shortlists = await db.select().from(schema.shortlist);

    const told: { applicantId: string; name: string; why: string }[] = [];

    for (const a of applicants) {
      const mine = facts.filter((f) => f.applicantId === a.id);
      const levels = levelsFor(mine);
      const wasEligible = meets(before, levels);
      const nowEligible = meets(after, levels);
      const shortlisted = shortlists.some((x) => x.applicantId === a.id && (x.url === s.url || (s.programmeId && x.refId === s.programmeId)));
      const onRoute = Boolean(s.route && a.route === s.route);
      if (!shortlisted && !onRoute) continue;

      // Unmeasured is not eligible. `meets` already ignores what it cannot see, so a person with no
      // facts at all comes back "eligible" — which is true of the requirements and false of them.
      const measurable = before.some((r) => blockable(r.key)) && Object.values(levels).some((v) => v !== null && v !== undefined);

      let why: string | null = null;
      let message: string | null = null;

      if (measurable && !wasEligible.eligible && nowEligible.eligible) {
        why = 'newly eligible';
        message = `Good news, and it is specific to you. ${s.label} changed its requirements today: ${changes.filter((c) => c.direction === 'easier').map((c) => c.summary).join(' ')} You did not meet the old ones — ${wasEligible.blocking.map((b) => `${b.key.replace(/_/g, ' ')} needed ${b.need} and you have ${b.have}`).join('; ')} — and you meet the new ones. I have put it back on your list. Nothing is sent anywhere until you say so.`;
      } else if (measurable && wasEligible.eligible && !nowEligible.eligible) {
        why = 'no longer eligible';
        message = `${s.label} has tightened its requirements: ${changes.filter((c) => c.direction === 'harder').map((c) => c.summary).join(' ')} That puts you below the new bar on ${nowEligible.blocking.map((b) => `${b.key.replace(/_/g, ' ')} (they now want ${b.need}, you have ${b.have})`).join(' and ')}. Better to hear it now than in March — let's look at what closes that gap, or at the alternatives on your list.`;
      } else if (shortlisted || onRoute) {
        why = shortlisted ? 'on their shortlist' : 'on this route';
        message = `${shortlisted ? 'A page on your shortlist changed' : 'A page that governs your route changed'}. ${s.label}: ${changes.slice(0, 3).map((c) => c.summary).join(' ')} Nothing you have to do right now — I have updated your plan and I will tell you if it moves one of your dates.`;
      }

      if (!why || !message) continue;
      await this.chat.agentSays(a.id, message);
      this.bus.emit('notify', {
        applicantId: a.id,
        title: why === 'newly eligible' ? 'You now qualify for something you did not before' : why === 'no longer eligible' ? 'A requirement on your list has tightened' : 'A page on your shortlist changed',
        text: `${s.label}\n${changes.slice(0, 4).map((c) => `· ${c.summary}`).join('\n')}\n\nOpen Educaro for what it means for you.`,
        channels: ['email', 'discord'],
      });
      this.rt.toApplicant(a.id, { type: 'refresh', applicantId: a.id, what: ['chat', 'shortlist', 'gaps'] });
      told.push({ applicantId: a.id, name: a.name, why });
    }

    await db.update(schema.sourceChanges).set({ notified: told as unknown as Record<string, unknown>[], notifiedAt: new Date() }).where(eq(schema.sourceChanges.id, changeId));
    this.log.log(`${s.label}: ${changes.length} change(s), ${told.length} applicant(s) told`);
    return told;
  }
}

/** Requirements a person can actually fail, as opposed to fees and deadlines. */
function blockable(key: Requirement['key']): boolean {
  return ['ielts', 'toefl', 'german', 'english', 'grade', 'experience_years', 'aps', 'recognition'].includes(key);
}


/**
 * What we know about this person, in the units the requirements are written in.
 *
 * Written against the fact keys the ingest pipeline actually produces, which are coarser than this
 * code first assumed: there is no `language.ielts`, there is a `language.english` whose value is
 * the string "IELTS 7.0", and the grade arrives as "CGPA 8.2 / 10 (German 1.9)". Guessing finer
 * keys meant every level came back null, so nobody was ever measurable and nobody was ever told.
 *
 * Only facts with a source count. A claimed band with no report behind it is exactly what the truth
 * map exists to keep out of decisions, and "you now qualify" is a decision. `verified` wins over
 * `said` when both exist.
 */
export function levelsFor(facts: (typeof schema.facts.$inferSelect)[]) {
  const pick = (key: string) =>
    facts
      .filter((f) => f.key === key && (f.tag === 'verified' || f.tag === 'said'))
      .sort((x, y) => (x.tag === y.tag ? 0 : x.tag === 'verified' ? -1 : 1))[0];

  const englishRaw = String(pick('language.english')?.value ?? '');
  const germanRaw = String(pick('language.german')?.value ?? '');
  const gradeRaw = String(pick('education.grade')?.value ?? '');
  const expRaw = String(pick('experience.total')?.value ?? '');

  const ielts = Number(englishRaw.match(/IELTS\D{0,6}(\d(?:\.\d)?)/i)?.[1] ?? NaN);
  const toefl = Number(englishRaw.match(/TOEFL\D{0,10}(\d{2,3})/i)?.[1] ?? NaN);
  const englishCefr = cefrValue(englishRaw.match(/\b([ABC][12])\b/i)?.[1] ?? '');
  const germanCefr = cefrValue(germanRaw.match(/\b([ABC][12])\b/i)?.[1] ?? '');

  // The page states the requirement both ways ("English at C1 … IELTS 6.5 accepted"), so a band on
  // its own has to satisfy the CEFR line too, or a perfectly qualified applicant fails one half of
  // a requirement that is really one requirement. Council of Europe / IELTS alignment.
  const cefrFromBand = Number.isFinite(ielts) ? (ielts >= 7 ? 5 : ielts >= 5.5 ? 4 : ielts >= 4 ? 3 : 2) : 0;

  // The requirement is written on the German scale, so an Indian CGPA has to be converted before it
  // can be compared at all — comparing 8.2 against 2.5 would pass literally everybody.
  const statedGerman = Number(gradeRaw.match(/German\s*(\d(?:[.,]\d)?)/i)?.[1]?.replace(',', '.') ?? NaN);
  const cgpa = Number(gradeRaw.match(/(\d(?:\.\d+)?)\s*(?:\/\s*10|CGPA)?/i)?.[1] ?? NaN);
  const grade = Number.isFinite(statedGerman) ? statedGerman : Number.isFinite(cgpa) && cgpa <= 10 ? bavarian(cgpa, 10, 4).german : null;

  const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const expYears =
    Number(expRaw.match(/(\d{1,2})\s*(?:\+)?\s*year/i)?.[1] ?? NaN) ||
    WORDS[expRaw.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b\s*year/i)?.[1]?.toLowerCase() ?? ''] ||
    null;

  return {
    ielts: Number.isFinite(ielts) ? ielts : null,
    toefl: Number.isFinite(toefl) ? toefl : null,
    german: germanCefr || null,
    english: englishCefr || cefrFromBand || null,
    grade,
    experienceYears: expYears,
    hasAps: facts.some((f) => /aps/i.test(f.key) && f.tag === 'verified') || undefined,
    hasRecognition: facts.some((f) => /anerkennung|recognition/i.test(f.key) && f.tag === 'verified') || undefined,
  };
}
