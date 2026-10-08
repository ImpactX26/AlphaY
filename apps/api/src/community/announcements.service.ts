import { Injectable, Logger } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../db/db';
import { BusService } from '../common/bus.service';
import { WebService } from '../web/web.service';
import { TraceService } from '../trace/trace.service';
import { CommunityService } from './community.service';
import { PROGRAMMES } from '../seed/catalogue';
import { CITIES } from '../knowledge/cities';

export const ANNOUNCEMENTS = 'educaro-announcements';

export interface Announcement {
  kind: 'programme' | 'job' | 'deadline' | 'note';
  title: string;
  detail: string;
  url: string | null;
  city: string | null;
}

/**
 * What is new in Germany this week, posted where the cohort already is.
 *
 * An applicant checks for openings and courses in the gaps between everything else, badly and
 * repeatedly, from a country where none of these sites are written for them. The agent is already
 * reading these sources for individual plans; collecting what is new and posting it once to the
 * whole cohort costs nothing extra and saves everyone the same search.
 *
 * It goes to a separate Discord channel from the conversation on purpose. A feed and a thread in
 * the same place means people mute both, and the thread is the part worth not muting.
 */
@Injectable()
export class AnnouncementsService {
  private readonly log = new Logger('Announcements');

  constructor(
    private readonly web: WebService,
    private readonly community: CommunityService,
    private readonly bus: BusService,
    private readonly trace: TraceService,
  ) {}

  /** Live openings from the Bundesagentur für Arbeit, for the roles this cohort is actually taking. */
  private async jobs(): Promise<Announcement[]> {
    const searches: { what: string; where: string; label: string }[] = [
      { what: 'Pflegefachkraft', where: 'Köln', label: 'Nursing' },
      { what: 'Pflegefachkraft', where: 'München', label: 'Nursing' },
      { what: 'Softwareentwickler', where: 'Berlin', label: 'Software' },
      { what: 'Ausbildung Pflege', where: 'Aachen', label: 'Ausbildung' },
    ];
    const out: Announcement[] = [];
    for (const s of searches) {
      const found = await this.web.jobSearch(s.what, s.where, { runId: 'announcements', applicantId: null }).catch(() => []);
      for (const j of found.slice(0, 3)) {
        out.push({
          kind: 'job',
          title: `${j.title} — ${j.employer}`,
          detail: `${s.label} · ${j.city || s.where}`,
          url: j.url,
          city: j.city || s.where,
        });
      }
    }
    return out;
  }

  /** Programmes in the catalogue, with whatever deadline we last read off their own page. */
  private programmes(): Announcement[] {
    return PROGRAMMES.map((p) => ({
      kind: 'programme' as const,
      title: `${p.title} — ${p.university}`,
      detail: `${p.city} · taught in ${p.language}`,
      url: p.url,
      city: p.city,
    }));
  }

  /** Deadlines inside the next eight weeks, across everyone's shortlists. */
  private async deadlines(): Promise<Announcement[]> {
    const rows = await db.select().from(schema.shortlist);
    const soon = new Date(Date.now() + 56 * 86_400_000);
    const seen = new Set<string>();
    const out: Announcement[] = [];
    for (const r of rows) {
      const d = (r.matrix as any)?.deadline?.date;
      if (!d) continue;
      const when = new Date(d);
      if (!(when > new Date() && when < soon)) continue;
      if (seen.has(r.title)) continue;
      seen.add(r.title);
      const days = Math.round((+when - Date.now()) / 86_400_000);
      out.push({ kind: 'deadline', title: `${r.title} closes in ${days} days`, detail: `${r.subtitle} · ${d}`, url: r.url || null, city: null });
    }
    return out;
  }

  /** Builds the digest. Read-only — nothing is posted until `publish`. */
  async build(): Promise<Announcement[]> {
    const [jobs, deadlines] = await Promise.all([this.jobs(), this.deadlines()]);
    const items = [...deadlines, ...jobs, ...this.programmes()];
    // Nothing already announced in the last fortnight, so a weekly feed does not repeat itself.
    const recent = await db
      .select()
      .from(schema.communityPosts)
      .where(eq(schema.communityPosts.channel, ANNOUNCEMENTS))
      .orderBy(desc(schema.communityPosts.createdAt))
      .limit(80);
    const already = new Set(recent.filter((p) => Date.now() - +p.createdAt < 14 * 86_400_000).map((p) => p.text.split('\n')[0]));
    return items.filter((i) => !already.has(line(i)));
  }

  /**
   * Posts the digest to the announcements channel, in the app and in Discord.
   *
   * One post per item rather than one long message: a wall of twenty links is read by nobody, and a
   * single item can be replied to, which is where the useful part of a cohort actually happens.
   */
  async publish(limit = 12): Promise<{ posted: number; items: Announcement[] }> {
    const items = (await this.build()).slice(0, limit);
    for (const item of items) {
      await this.community.post({
        channel: ANNOUNCEMENTS,
        author: 'Educaro',
        authorKind: 'staff',
        text: line(item),
      });
    }
    await this.trace.record('event', 'announcements_published', { count: items.length, kinds: [...new Set(items.map((i) => i.kind))] });
    this.log.log(`${items.length} announcements published`);
    return { posted: items.length, items };
  }

  async list(limit = 40) {
    return this.community.list(ANNOUNCEMENTS, limit);
  }

  /** Cities the cohort is actually heading to, so the feed can be filtered to somewhere useful. */
  cities(): string[] {
    return CITIES.map((c) => c.name);
  }
}

const ICON: Record<Announcement['kind'], string> = { programme: '🎓', job: '💼', deadline: '⏳', note: '📣' };

function line(a: Announcement): string {
  return `${ICON[a.kind]} **${a.title}**\n${a.detail}${a.url ? `\n${a.url}` : ''}`;
}
