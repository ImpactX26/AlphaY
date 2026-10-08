import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { db, schema } from '../db/db';
import { BusService } from '../common/bus.service';
import { ChatService } from '../profile/chat.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TraceService } from '../trace/trace.service';
import { findCity, DEFAULT_CITY } from '../knowledge/cities';
import { monthLabel, parseMonth } from '../knowledge/normalize';

type Group = typeof schema.cohortGroups.$inferSelect;
type Member = typeof schema.cohortMembers.$inferSelect;

/**
 * Flat-shares and travel groups.
 *
 * The screen used to compute a sentence — "a flat for three in Ehrenfeld works out at about EUR 490
 * each" — which is a true sentence that does nothing. Arriving alone in a country whose language you
 * do not yet have is the part that breaks people, and it is solvable with a list this product
 * already holds. What was missing was the ability to say yes to somebody.
 *
 * Three rules this service exists to enforce:
 *
 * - **Nobody is a member until they agreed.** Anyone may propose; a row appears immediately, but it
 *   is `invited` or `requested` until the other side acts. An app that can put you in a flat with a
 *   stranger because someone typed your name is worse than no feature.
 * - **Nobody's details leak before that.** Until two people are both `joined`, each sees a first
 *   name and a route. After, they see enough to actually talk.
 * - **The split is arithmetic, and it is shown.** "Split evenly" has to come back as a number per
 *   person per month, or the group is a chat room with extra steps.
 */
@Injectable()
export class GroupsService {
  private readonly log = new Logger('Groups');

  constructor(
    private readonly bus: BusService,
    private readonly chat: ChatService,
    private readonly rt: RealtimeGateway,
    private readonly trace: TraceService,
  ) {}

  // ------------------------------------------------------------------ reads

  /** Everything this applicant can see: their own groups first, then open ones they could join. */
  async forApplicant(applicantId: string) {
    const me = await db.query.applicants.findFirst({ where: eq(schema.applicants.id, applicantId) });
    if (!me) throw new NotFoundException('No such applicant');

    const mine = await db.select().from(schema.cohortMembers).where(eq(schema.cohortMembers.applicantId, applicantId));
    const myGroupIds = mine.map((m) => m.groupId);

    const city = me.targetCity ?? null;
    // Open groups in the city they are actually going to. A flat-share in another city is not an
    // opportunity, it is noise, and noise is why people stop reading this section.
    const open = city
      ? await db.select().from(schema.cohortGroups).where(and(eq(schema.cohortGroups.city, city), eq(schema.cohortGroups.status, 'open')))
      : [];

    const ids = [...new Set([...myGroupIds, ...open.map((g) => g.id)])];
    if (!ids.length) return { groups: [], suggestion: await this.suggestion(applicantId) };

    const groups = await db.select().from(schema.cohortGroups).where(inArray(schema.cohortGroups.id, ids));
    const members = await db.select().from(schema.cohortMembers).where(inArray(schema.cohortMembers.groupId, ids));
    const people = await db.select().from(schema.applicants);
    const byId = new Map(people.map((p) => [p.id, p]));

    const dtos = groups
      .map((g) => this.dto(g, members.filter((m) => m.groupId === g.id), byId, applicantId))
      .sort((a, b) => Number(b.youAre !== null) - Number(a.youAre !== null) || a.title.localeCompare(b.title));

    return { groups: dtos, suggestion: await this.suggestion(applicantId) };
  }

  private dto(g: Group, members: Member[], byId: Map<string, typeof schema.applicants.$inferSelect>, viewerId: string) {
    const joined = members.filter((m) => m.status === 'joined');
    const mine = members.find((m) => m.applicantId === viewerId) ?? null;
    // Once you are in, you can see who else is in. Before that, first names only — nobody consented
    // to being listed by full name in a group they have not joined.
    const inside = mine?.status === 'joined';

    return {
      id: g.id,
      kind: g.kind,
      title: g.title,
      city: g.city,
      month: g.month,
      district: g.district,
      seats: g.seats,
      fromCity: g.fromCity,
      note: g.note,
      status: g.status,
      rentSplit: g.rentSplit,
      budgetEachEur: g.budgetEachEur,
      /** The arithmetic, done. "Split evenly" is only an answer once it is a number. */
      shareEachEur: splitEach(g),
      shareNowEur: splitNow(g, joined.length),
      seatsLeft: Math.max(0, g.seats - joined.length),
      members: members
        .filter((m) => m.status === 'joined' || m.applicantId === viewerId)
        .map((m) => {
          const p = byId.get(m.applicantId);
          const first = p?.name.split(' ')[0] ?? 'Someone';
          return {
            applicantId: inside || m.applicantId === viewerId ? m.applicantId : null,
            label: inside || m.applicantId === viewerId ? (p?.name ?? first) : `${first} ${p?.name.split(' ')[1]?.[0] ?? ''}.`.trim(),
            route: p?.route ?? 'deciding',
            homeCity: p?.homeCity ?? null,
            role: m.role,
            status: m.status,
          };
        }),
      /** Where the viewer stands: null means they have nothing to do with this group yet. */
      youAre: mine ? mine.status : null,
      /** Someone asked to live with them and is waiting for an answer. */
      awaitingYou: mine?.status === 'invited',
    };
  }

  /**
   * Who they could be sharing with, when they are in no group yet.
   *
   * Same city, same arrival month, and not already grouped with them. Deliberately a suggestion
   * rather than an auto-created group: a group nobody chose is a group nobody joins.
   */
  private async suggestion(applicantId: string) {
    const me = await db.query.applicants.findFirst({ where: eq(schema.applicants.id, applicantId) });
    if (!me?.targetCity) return null;
    const others = await db
      .select()
      .from(schema.applicants)
      .where(and(ne(schema.applicants.id, applicantId), eq(schema.applicants.targetCity, me.targetCity)));
    const peers = others.filter((o) => o.name !== me.name);
    if (!peers.length) return null;

    const city = findCity(me.targetCity) ?? DEFAULT_CITY;
    const when = parseMonth(me.startDate) ?? { y: new Date().getFullYear() + 1, m: 9 };
    const seats = Math.min(3, peers.length + 1);
    return {
      city: city.name,
      month: monthLabel(when),
      district: city.districts[0] ?? null,
      seats,
      // A WG room is already a share; a whole flat split three ways lands under it per person.
      budgetEachEur: Math.round(city.wgRoom * 0.85),
      candidates: peers.slice(0, 6).map((p) => ({
        applicantId: p.id,
        label: `${p.name.split(' ')[0]} ${p.name.split(' ')[1]?.[0] ?? ''}.`.trim(),
        route: p.route ?? 'deciding',
        homeCity: p.homeCity ?? null,
        sharedInterest: p.route === me.route ? 'same route' : p.homeCity ? `from ${p.homeCity}` : null,
      })),
    };
  }

  // ------------------------------------------------------------------ writes

  /** Start a flat-share or a travel group. The creator is joined; everyone else has to agree. */
  async create(
    applicantId: string,
    input: { kind?: 'flat_share' | 'travel'; city?: string; month?: string; district?: string; seats?: number; budgetEachEur?: number; fromCity?: string; note?: string; invite?: string[] },
  ) {
    const me = await db.query.applicants.findFirst({ where: eq(schema.applicants.id, applicantId) });
    if (!me) throw new NotFoundException('No such applicant');

    const kind = input.kind ?? 'flat_share';
    const city = input.city ?? me.targetCity ?? DEFAULT_CITY.name;
    const info = findCity(city) ?? DEFAULT_CITY;
    const month = input.month ?? monthLabel(parseMonth(me.startDate) ?? { y: new Date().getFullYear() + 1, m: 9 });
    const seats = Math.max(2, Math.min(6, input.seats ?? 3));

    const [g] = await db
      .insert(schema.cohortGroups)
      .values({
        kind,
        title: kind === 'travel' ? `Flying to ${city}, ${month}` : `Flat-share in ${city}, ${month}`,
        city,
        month,
        district: input.district ?? (kind === 'flat_share' ? info.districts[0] ?? null : null),
        seats,
        budgetEachEur: kind === 'flat_share' ? (input.budgetEachEur ?? Math.round(info.wgRoom * 0.85)) : null,
        fromCity: input.fromCity ?? me.homeCity ?? null,
        createdBy: applicantId,
        note: input.note ?? null,
      })
      .returning();

    await db.insert(schema.cohortMembers).values({ groupId: g.id, applicantId, role: 'owner', status: 'joined' });
    for (const target of input.invite ?? []) await this.invite(applicantId, g.id, target).catch((e) => this.log.warn(`invite: ${e.message}`));

    await this.trace.record('event', 'cohort_group_created', { kind, city, month, seats }, { applicantId });
    this.rt.toApplicant(applicantId, { type: 'refresh', applicantId, what: ['groups'] });
    return this.one(g.id, applicantId);
  }

  /**
   * Ask a named person to share.
   *
   * `who` is whatever the applicant typed or the bot parsed — an id, a first name, a Discord
   * display name. Resolving loosely is the point: in a Discord channel nobody types a UUID.
   */
  async invite(applicantId: string, groupId: string, who: string) {
    const g = await this.group(groupId);
    await this.assertMember(groupId, applicantId);
    const target = await this.resolve(who, applicantId);
    if (!target) throw new NotFoundException(`I could not work out who "${who}" is. Try their first name as it appears in the cohort.`);
    if (target.id === applicantId) throw new BadRequestException('You are already in this group.');

    const existing = await db.query.cohortMembers.findFirst({
      where: and(eq(schema.cohortMembers.groupId, groupId), eq(schema.cohortMembers.applicantId, target.id)),
    });
    if (existing?.status === 'joined') return this.one(groupId, applicantId);
    if (!existing) await db.insert(schema.cohortMembers).values({ groupId, applicantId: target.id, status: 'invited' });
    else await db.update(schema.cohortMembers).set({ status: 'invited' }).where(eq(schema.cohortMembers.id, existing.id));

    const me = await db.query.applicants.findFirst({ where: eq(schema.applicants.id, applicantId) });
    const each = splitEach(g);
    const asked = me?.name.split(' ')[0] ?? 'Someone';

    // The invitation goes wherever they already are. A flat-share proposal that only exists on a
    // screen they open twice a week is a proposal that expires unanswered.
    await this.chat.agentSays(
      target.id,
      g.kind === 'travel'
        ? `${asked} is flying to ${g.city} around ${g.month} and asked if you want to travel together. Nothing is shared unless you say yes — open Community to accept or decline.`
        : `${asked} asked if you would like to share a flat in ${g.city} from ${g.month}${g.district ? `, around ${g.district}` : ''}. Split evenly that is about EUR ${each} each a month${g.budgetEachEur ? `, against about EUR ${g.budgetEachEur} for a room on your own` : ''}. Nothing is shared unless you say yes — open Community to accept or decline.`,
    );
    this.bus.emit('group_invite', {
      applicantId: target.id,
      groupId: g.id,
      from: asked,
      title: g.kind === 'travel' ? 'Travel together?' : 'A flat-share invitation',
      text:
        g.kind === 'travel'
          ? `**${asked}** is flying to ${g.city} around ${g.month} and asked if you want to travel together.`
          : `**${asked}** asked if you would like to share a flat in ${g.city} from ${g.month}${g.district ? `, around ${g.district}` : ''}.
Split evenly that is about **EUR ${each} each a month**${g.budgetEachEur ? ` — a room on your own there is about EUR ${g.budgetEachEur}` : ''}.`,
    });
    this.rt.toApplicant(target.id, { type: 'refresh', applicantId: target.id, what: ['groups'] });
    await this.trace.record('event', 'cohort_invite', { groupId, to: target.id }, { applicantId });
    return this.one(groupId, applicantId);
  }

  /** Asking to join a group you found, rather than being asked. Still needs the owner to agree. */
  async request(applicantId: string, groupId: string) {
    const g = await this.group(groupId);
    if (g.status !== 'open') throw new BadRequestException('That group is not taking anyone else.');
    const existing = await db.query.cohortMembers.findFirst({
      where: and(eq(schema.cohortMembers.groupId, groupId), eq(schema.cohortMembers.applicantId, applicantId)),
    });
    if (existing?.status === 'invited') return this.respond(applicantId, groupId, true);
    if (existing?.status === 'joined') return this.one(groupId, applicantId);
    if (!existing) await db.insert(schema.cohortMembers).values({ groupId, applicantId, status: 'requested' });
    else await db.update(schema.cohortMembers).set({ status: 'requested' }).where(eq(schema.cohortMembers.id, existing.id));

    const me = await db.query.applicants.findFirst({ where: eq(schema.applicants.id, applicantId) });
    if (g.createdBy) {
      await this.chat.agentSays(g.createdBy, `${me?.name.split(' ')[0] ?? 'Someone'} asked to join "${g.title}". Open Community to accept or decline.`);
      this.rt.toApplicant(g.createdBy, { type: 'refresh', applicantId: g.createdBy, what: ['groups'] });
    }
    await this.trace.record('event', 'cohort_request', { groupId }, { applicantId });
    return this.one(groupId, applicantId);
  }

  /** Yes or no. This is the only thing that makes somebody a member. */
  async respond(applicantId: string, groupId: string, accept: boolean) {
    const g = await this.group(groupId);
    const row = await db.query.cohortMembers.findFirst({
      where: and(eq(schema.cohortMembers.groupId, groupId), eq(schema.cohortMembers.applicantId, applicantId)),
    });
    if (!row) throw new NotFoundException('You have not been asked to join this group.');

    if (!accept) {
      await db.update(schema.cohortMembers).set({ status: 'declined' }).where(eq(schema.cohortMembers.id, row.id));
      await this.trace.record('event', 'cohort_declined', { groupId }, { applicantId });
      return this.one(groupId, applicantId);
    }

    const joined = await this.joinedCount(groupId);
    if (joined >= g.seats) throw new BadRequestException('That group is full.');

    const each = splitEach(g);
    await db.update(schema.cohortMembers).set({ status: 'joined', shareEur: each }).where(eq(schema.cohortMembers.id, row.id));
    // Everyone's share changes when the group grows, so it is recomputed for all of them, not just
    // the person who joined. A number that is right for one member and stale for the rest is worse
    // than no number, because two people will quote different figures to the same landlord.
    await db.update(schema.cohortMembers).set({ shareEur: each }).where(and(eq(schema.cohortMembers.groupId, groupId), eq(schema.cohortMembers.status, 'joined')));
    if (joined + 1 >= g.seats) await db.update(schema.cohortGroups).set({ status: 'full' }).where(eq(schema.cohortGroups.id, groupId));

    const me = await db.query.applicants.findFirst({ where: eq(schema.applicants.id, applicantId) });
    const first = me?.name.split(' ')[0] ?? 'Someone';
    for (const other of await this.joinedIds(groupId)) {
      if (other === applicantId) continue;
      await this.chat.agentSays(
        other,
        g.kind === 'travel'
          ? `${first} is travelling with you to ${g.city} in ${g.month}. I will keep both your arrival plans in step.`
          // The flat is sized by the group, not by how many have answered yet: searching for a
          // two-person flat because the third has not replied finds the wrong flats.
          : `${first} is in. That makes ${joined + 1} of you on "${g.title}" — about EUR ${each} each a month once it is full, ${splitNow(g, joined + 1) ?? each} each until then. I will look for flats that take ${g.seats}.`,
      );
      this.rt.toApplicant(other, { type: 'refresh', applicantId: other, what: ['groups'] });
    }
    await this.chat.agentSays(
      applicantId,
      g.kind === 'travel'
        ? `You are in "${g.title}". I will tell you when the others book, so you can fly together.`
        : `You are in "${g.title}" — ${joined + 1} of ${g.seats}, about EUR ${each} each a month split evenly. I will send flats in ${g.district ?? g.city} that take ${g.seats}, and I check every listing and landlord before you reply to one.`,
    );
    this.rt.toApplicant(applicantId, { type: 'refresh', applicantId, what: ['groups'] });
    this.rt.toStaff({ type: 'refresh', applicantId, what: ['groups'] });
    await this.trace.record('event', 'cohort_joined', { groupId, members: joined + 1, shareEur: each }, { applicantId });
    return this.one(groupId, applicantId);
  }

  async leave(applicantId: string, groupId: string) {
    const row = await db.query.cohortMembers.findFirst({
      where: and(eq(schema.cohortMembers.groupId, groupId), eq(schema.cohortMembers.applicantId, applicantId)),
    });
    if (!row) throw new NotFoundException('You are not in that group.');
    await db.delete(schema.cohortMembers).where(eq(schema.cohortMembers.id, row.id));
    // Leaving reopens the group and makes everyone else's share go up. Both are true and both have
    // to be said, because the second one is the part that affects somebody's budget.
    const left = await this.joinedCount(groupId);
    const g = await this.group(groupId);
    const each = splitEach(g);
    await db.update(schema.cohortGroups).set({ status: 'open' }).where(eq(schema.cohortGroups.id, groupId));
    await db.update(schema.cohortMembers).set({ shareEur: each }).where(and(eq(schema.cohortMembers.groupId, groupId), eq(schema.cohortMembers.status, 'joined')));
    for (const other of await this.joinedIds(groupId)) {
      await this.chat.agentSays(other, `Someone left "${g.title}". That is ${left} of you now, so the split is about EUR ${each} each. Nothing else changes.`);
      this.rt.toApplicant(other, { type: 'refresh', applicantId: other, what: ['groups'] });
    }
    await this.trace.record('event', 'cohort_left', { groupId }, { applicantId });
    return { ok: true as const };
  }

  // ------------------------------------------------------------------ helpers

  async one(groupId: string, viewerId: string) {
    const g = await this.group(groupId);
    const members = await db.select().from(schema.cohortMembers).where(eq(schema.cohortMembers.groupId, groupId));
    const people = await db.select().from(schema.applicants);
    return this.dto(g, members, new Map(people.map((p) => [p.id, p])), viewerId);
  }

  private async group(groupId: string): Promise<Group> {
    const g = await db.query.cohortGroups.findFirst({ where: eq(schema.cohortGroups.id, groupId) });
    if (!g) throw new NotFoundException('No such group');
    return g;
  }

  private async assertMember(groupId: string, applicantId: string) {
    const row = await db.query.cohortMembers.findFirst({
      where: and(eq(schema.cohortMembers.groupId, groupId), eq(schema.cohortMembers.applicantId, applicantId)),
    });
    if (row?.status !== 'joined') throw new BadRequestException('Only someone already in the group can invite.');
  }

  private async joinedCount(groupId: string) {
    const rows = await db.select().from(schema.cohortMembers).where(and(eq(schema.cohortMembers.groupId, groupId), eq(schema.cohortMembers.status, 'joined')));
    return rows.length;
  }

  private async joinedIds(groupId: string) {
    const rows = await db.select().from(schema.cohortMembers).where(and(eq(schema.cohortMembers.groupId, groupId), eq(schema.cohortMembers.status, 'joined')));
    return rows.map((r) => r.applicantId);
  }

  /**
   * "I'd like to stay with Rohan" has to find Rohan.
   *
   * Nobody types a UUID into a Discord channel, so this takes an id, a first name, a full name or a
   * Discord mention, and prefers people going to the same city — which is both the likely match and
   * the only one where the answer is useful.
   */
  async resolve(who: string, askerId: string) {
    const raw = (who ?? '').trim();
    if (!raw) return null;
    const all = await db.select().from(schema.applicants);
    const byId = all.find((a) => a.id === raw);
    if (byId) return byId;

    // A Discord mention is <@123456789>; the id behind it is a user, not an applicant.
    const mention = raw.match(/^<@!?(\d+)>$/)?.[1];
    if (mention) {
      const u = await db.query.users.findFirst({ where: eq(schema.users.discordUserId, mention) });
      const hit = u ? all.find((a) => a.userId === u.id) : null;
      if (hit) return hit;
    }

    const asker = all.find((a) => a.id === askerId);
    const needle = raw.toLowerCase().replace(/^@/, '');
    const candidates = all.filter(
      (a) => a.id !== askerId && (a.name.toLowerCase() === needle || a.name.toLowerCase().split(' ')[0] === needle || a.name.toLowerCase().startsWith(needle)),
    );
    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];

    /**
     * Two people with the same first name is normal in this cohort, and picking one arbitrarily is
     * how an invitation goes to a stranger. This happened: a proposal to "Ananya" landed on a
     * duplicate file with no contact details, so the real Ananya was never asked and nothing said
     * so. Rank by how likely each is to be the one meant, and refuse when it is genuinely a toss-up.
     */
    const score = async (a: (typeof all)[number]) => {
      const u = a.userId ? await db.query.users.findFirst({ where: eq(schema.users.id, a.userId) }) : null;
      return (
        (asker?.targetCity && a.targetCity === asker.targetCity ? 4 : 0) +
        (u?.discordUserId ? 2 : 0) +
        (a.targetCity ? 1 : 0) +
        (a.name.toLowerCase() === needle ? 1 : 0)
      );
    };
    const ranked = await Promise.all(candidates.map(async (c) => ({ c, score: await score(c) })));
    ranked.sort((x, y) => y.score - x.score);
    // A clear winner, or nobody. Guessing between two equal matches is the failure mode itself.
    if (ranked.length > 1 && ranked[0].score === ranked[1].score) return null;
    return ranked[0].c;
  }

  /**
   * The whole flat-share flow in one call, for the bot.
   *
   * "I'd like to stay with Rohan and split the rent evenly" should not require the person saying it
   * to first create a group, then find an id, then invite. It is one intention, so it is one method:
   * reuse an open group of theirs if they have one, otherwise start one, then ask the other person.
   */
  async proposeShare(applicantId: string, who: string, opts: { kind?: 'flat_share' | 'travel' } = {}) {
    const kind = opts.kind ?? 'flat_share';
    const target = await this.resolve(who, applicantId);
    if (!target) throw new NotFoundException(`I could not work out who "${who}" is. Use their first name as it shows in the cohort.`);

    const mine = await db.select().from(schema.cohortMembers).where(and(eq(schema.cohortMembers.applicantId, applicantId), eq(schema.cohortMembers.status, 'joined')));
    const groups = mine.length ? await db.select().from(schema.cohortGroups).where(inArray(schema.cohortGroups.id, mine.map((m) => m.groupId))) : [];
    const reuse = groups.find((g) => g.kind === kind && g.status === 'open');

    const group = reuse ?? (await this.createRaw(applicantId, kind));
    await this.invite(applicantId, group.id, target.id);
    return { group: await this.one(group.id, applicantId), invited: { applicantId: target.id, label: target.name.split(' ')[0] } };
  }

  private async createRaw(applicantId: string, kind: 'flat_share' | 'travel'): Promise<Group> {
    const dto = await this.create(applicantId, { kind });
    return this.group(dto.id);
  }

  /** Staff view: every group and how full it is, so a consultant can see who is still alone. */
  async all() {
    const groups = await db.select().from(schema.cohortGroups).orderBy(desc(schema.cohortGroups.createdAt));
    if (!groups.length) return [];
    const members = await db.select().from(schema.cohortMembers).where(inArray(schema.cohortMembers.groupId, groups.map((g) => g.id)));
    const people = await db.select().from(schema.applicants);
    const byId = new Map(people.map((p) => [p.id, p]));
    return groups.map((g) => {
      const ms = members.filter((m) => m.groupId === g.id);
      const joined = ms.filter((m) => m.status === 'joined');
      return {
        id: g.id,
        kind: g.kind,
        title: g.title,
        city: g.city,
        month: g.month,
        status: g.status,
        seats: g.seats,
        joined: joined.length,
        pending: ms.filter((m) => m.status === 'invited' || m.status === 'requested').length,
        shareEachEur: splitEach(g),
        shareNowEur: splitNow(g, joined.length),
        members: joined.map((m) => byId.get(m.applicantId)?.name ?? 'Someone'),
        createdAt: g.createdAt.toISOString(),
      };
    });
  }
}

/**
 * What each person pays, split evenly.
 *
 * Two numbers, because one of them cannot answer both questions people have. `splitEach` is the
 * share at the size the flat is actually for, which is the figure you quote to a landlord and the
 * one that makes the group worth joining. `splitNow` is what the people currently in it would pay
 * between them today.
 *
 * The first version returned total ÷ joined for everything, which meant a group of one displayed
 * the whole flat's rent as that person's share — EUR 1,479 where the honest answer was EUR 493.
 * Nobody rents a three-person flat alone, so that number described a situation that does not exist
 * and made the feature look broken at exactly the moment somebody first opens it.
 */
export function splitEach(g: Group): number | null {
  if (g.kind !== 'flat_share' || !g.budgetEachEur) return null;
  return g.budgetEachEur;
}

/** What the people already in it would each pay today — only meaningful once there are two. */
export function splitNow(g: Group, joined: number): number | null {
  if (g.kind !== 'flat_share' || !g.budgetEachEur || joined < 2) return null;
  return Math.round((g.budgetEachEur * g.seats) / joined);
}
