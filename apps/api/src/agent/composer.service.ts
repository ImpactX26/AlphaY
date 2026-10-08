import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Block, ScreenSection, SectionId, Screen, ItemStatus, Route } from '@educaro/shared';
import { ROUTE_LABEL, SECTION_LABEL } from '@educaro/shared';
import { db, schema } from '../db/db';
import { LlmService } from '../llm/llm.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TraceService } from '../trace/trace.service';
import { ROUTES } from '../knowledge/routes';
import { service, servicesForRoute } from '../knowledge/services';
import { daysUntil, midSentence } from '../knowledge/normalize';
import { convertIndianGrade } from '../knowledge/grades';
import { bestFact, factData, type ApplicantState } from './state.service';
import type { CheckReport } from './checks';

const Composition = z.object({
  headline: z.string(),
  footnote: z.string(),
  order: z.array(z.string()),
  copy: z.array(z.object({ id: z.string(), title: z.string(), body: z.string() })),
});
type Composition = z.infer<typeof Composition>;

const COMPOSER_SYSTEM = `You write one applicant's personal screen in the Educaro app (Indian applicants moving to Germany).
Code already filled every block with data. You only:
1) order the block ids, most urgent and useful first (open questions near the top, never last),
2) write "headline": max 30 words, start with their first name, lead with the one most important fact or action,
3) write "footnote": max 25 words, one personal touch from their story (family, city, money), or an empty string,
4) for each block id, a "title" (max 6 words) and a "body" (max 30 words) in plain, warm English.
Rules: use only facts given. Keep German words (Anmeldung, Anerkennung, Sperrkonto) and explain them in a few words the first time.
Never say "rejected" or "not eligible": gaps always come with a plan. No emojis. No markdown.`;

/** Fixed blocks, free words. */
@Injectable()
export class ComposerService {
  constructor(
    private readonly llm: LlmService,
    private readonly rt: RealtimeGateway,
    private readonly trace: TraceService,
  ) {}

  build(state: ApplicantState, report: CheckReport): { blocks: Block[]; headline: string; footnote: string; mode: Screen['mode'] } {
    const a = state.applicant;
    const first = a.name.split(/\s+/)[0];
    const outputs = state.outputs;
    const blocks: Block[] = [];
    const processing = state.files.some((f) => f.status === 'queued' || f.status === 'reading');
    const anyDone = state.files.some((f) => f.status === 'done' || f.status === 'unclear');
    const mode: Screen['mode'] = a.mode === 'germany' ? 'germany' : anyDone ? 'planning' : 'onboarding';
    const route = a.route as Route | null;

    // ---------- nothing on file yet ----------
    // The recorder lives in the story intake, and Home stands that intake up only when the screen
    // has no blocks at all. Composing a "Tell your story" card instead is worse than composing
    // nothing: its button opens the document drop, whose own "No video yet" links back to Home, so
    // a new applicant walks a loop with no recorder anywhere in it. An applicant who has told us
    // nothing gets the words and no blocks -- which is the intake -- and the screen fills the
    // moment there is anything real to put on it.
    const pristine = !state.files.length && !state.questions.some((q) => q.status === 'open');
    if (mode === 'onboarding' && pristine) {
      return { blocks: [], headline: templateHeadline(state, report), footnote: '', mode };
    }

    // ---------- Germany mode ----------
    if (mode === 'germany') {
      const life = outputs.life?.output;
      const money = outputs.money?.output;
      if (life?.arrival) blocks.push({ id: 'arrival', type: 'arrival', phases: life.arrival.map((p: any) => ({ title: p.title, items: p.items.map((i: string) => ({ label: i, done: false })) })) });
      if (life?.groups) blocks.push({ id: 'places', type: 'places', city: life.city, center: life.center, groups: life.groups });
      if (money) blocks.push(budgetBlock(money));
      const housingG = outputs.housing?.output as any;
      if (housingG?.listings?.length) blocks.push(rentalsBlock(housingG));
      if (money?.pay) {
        blocks.push({
          id: 'payslip',
          type: 'checklist',
          title: 'Your first payslip, line by line',
          items: [
            { label: `Gross pay: €${money.pay.gross.toFixed(2)}`, status: 'said' as ItemStatus },
            ...money.pay.lines.map((l: any) => ({ label: `${l.label}: €${Math.abs(l.amount).toFixed(2)}`, status: 'pending' as ItemStatus })),
            { label: `Net pay: about €${money.pay.net.toFixed(2)}`, status: 'verified' as ItemStatus, note: money.pay.note },
          ],
        });
      }
      // Once they are here, the safety half matters more than the planning half: rights at work, a
      // landlord to check before a deposit leaves, and the people who arrived the same month.
      const safetyG = outputs.safety?.output as any;
      if (safetyG?.rights) blocks.push(helpBlock(safetyG));
      if (safetyG?.group) blocks.push(groupBlock(safetyG.group));
      if (safetyG?.scam) blocks.push(scamBlock(safetyG));
      if (state.community.length) blocks.push(communityBlock(state));
      blocks.push({ id: 'services', type: 'services', services: [service('integration-companion')!, service('intercultural-workshop')!, service('consultant', state.applicant.id)!] });
      blocks.push(timelineBlock(state));
      return {
        blocks,
        mode,
        headline: `${first}, welcome to ${life?.city ?? 'Germany'}. Anmeldung first: it unlocks your tax ID, bank account and everything after.`,
        footnote: life?.groups?.[0]?.places?.[0] ? `${life.groups[0].places[0].name} is the closest Indian grocery to you.` : '',
      };
    }

    // ---------- questions (two at most, guarded on creation) ----------
    const open = state.questions.filter((q) => q.status === 'open');
    const qBlocks: Block[] = open.slice(0, 2).map((q) => ({ id: `q-${q.id}`, type: 'question', questionId: q.id, prompt: q.prompt, why: q.why, options: q.options }));

    // ---------- next step ----------
    const top = report.gaps[0];
    if (!anyDone) {
      blocks.push({
        id: 'next-step',
        type: 'next_step',
        title: 'Tell your story',
        body: 'Record a 1 to 3 minute video and drop every document you have, in any order. Phone photos are fine.',
        actions: [{ label: 'Record video', kind: 'upload', value: 'video' }, { label: 'Add documents', kind: 'upload', value: 'files' }],
        tags: [],
      });
    } else if (top) {
      const svc = top.serviceId ? service(top.serviceId, state.applicant.id) : undefined;
      blocks.push({
        id: 'next-step',
        type: 'next_step',
        title: top.title,
        body: top.what,
        actions: [
          ...(svc ? [{ label: svc.name, kind: 'service' as const, value: svc.url }] : []),
          ...top.links.slice(0, 1).map((l) => ({ label: l.label, kind: 'link' as const, value: l.url })),
          { label: 'Why this first?', kind: 'chat' as const, value: `Why is "${top.title}" my next step?` },
        ],
        tags: top.links.some((l) => !l.url.includes('educaro.de')) ? ['web'] : [],
        service: svc,
      });
    } else if (route) {
      blocks.push({
        id: 'next-step',
        type: 'next_step',
        title: a.submittedAt ? 'Waiting for Educaro to approve' : 'Nothing left open',
        body: a.submittedAt ? 'An Educaro advisor is reviewing your profile.' : 'Every gap has a plan you have seen. Submit your profile to Educaro.',
        actions: a.submittedAt ? [] : [{ label: 'Submit to Educaro', kind: 'chat', value: 'submit' }],
        tags: [],
      });
    }
    blocks.push(...qBlocks);

    // ---------- documents (live while reading) ----------
    if (state.files.length) {
      blocks.push({
        id: 'documents',
        type: 'documents',
        title: processing ? 'Reading your files' : 'Your files',
        items: state.files.map((f) => ({ id: f.id, name: f.kindLabel ?? f.originalName, kind: f.kind, status: f.status })),
      });
    }

    // ---------- truth map ----------
    if (state.truth.rows.length) blocks.push({ id: 'truth-map', type: 'truth_map', rows: state.truth.rows });

    // ---------- route ----------
    const r = outputs.route?.output;
    if (route) {
      blocks.push({
        id: 'route',
        type: 'route',
        primary: route,
        alternatives: (a.routeAlternatives as Route[]) ?? [],
        reasons: (a.routeReasons?.length ? a.routeReasons : r?.reasons) ?? [],
        ...(route === 'chancenkarte' || (a.routeAlternatives ?? []).includes('chancenkarte') ? { chancenkarte: r?.chancenkarte } : {}),
      });
    }

    // ---------- papers ----------
    if (route) {
      const kinds = new Set(state.files.filter((f) => f.status === 'done').map((f) => f.kind));
      const plannedKeys = new Set(report.gaps.map((g) => g.key));
      blocks.push({
        id: 'papers',
        type: 'checklist',
        title: 'Papers',
        items: ROUTES[route].papers.map((p) => {
          const have = p.kinds.some((k) => kinds.has(k));
          const planned = (p.key === 'german' && [...plannedKeys].some((k) => k.startsWith('german'))) || (p.key === 'aps' && plannedKeys.has('aps')) || (p.key === 'english' && plannedKeys.has('english_report'));
          return { label: p.label, status: (have ? 'verified' : planned ? 'planned' : 'missing') as ItemStatus };
        }),
      });
    }

    // ---------- shortlist and matrices ----------
    if (state.shortlist.length) {
      blocks.push({
        id: 'shortlist',
        type: 'shortlist',
        items: state.shortlist.map((s) => ({ id: s.id, title: s.title, subtitle: s.subtitle, status: s.status as ItemStatus, gapCount: s.gapCount, url: s.url })),
      });
      for (const s of state.shortlist) {
        const m = s.matrix as any;
        if (!m) continue;
        blocks.push({ id: `matrix-${s.id}`, type: 'requirement_matrix', shortlistId: s.id, title: `${s.title} · ${s.subtitle.split(' · ')[1] ?? ''}`.trim(), rows: m.rows ?? [], exams: m.exams ?? [], deadline: m.deadline });
      }
    }

    // ---------- opportunities (scout / jobs) ----------
    const scout = outputs.scout?.output?.programmes as any[] | undefined;
    const jobs = outputs.jobs?.output?.openings as any[] | undefined;
    const opp = (route === 'study' ? scout : jobs) ?? [];
    if (opp.length) {
      blocks.push({
        id: 'opportunities',
        type: 'opportunities',
        title: route === 'study' ? 'Programmes that fit' : 'Openings with Educaro partners',
        items: opp.slice(0, 5).map((o) => ({ id: o.id, title: o.title, subtitle: o.subtitle, url: o.url, kind: o.kind, why: o.why, shortlisted: !!o.shortlisted })),
      });
    }

    // ---------- gaps with plans ----------
    if (report.gaps.length > 1) {
      blocks.push({
        id: 'gaps',
        type: 'gap_plan',
        title: 'Your plan',
        gaps: report.gaps.map((g) => ({ id: g.key, title: g.title, what: g.what, where: g.where, howLong: g.howLong, cost: g.cost, links: g.links, service: g.serviceId ? service(g.serviceId, state.applicant.id) : undefined })),
      });
    }

    // ---------- readiness ----------
    if (route && anyDone) blocks.push({ id: 'readiness', type: 'readiness', overall: report.readiness.overall, outcome: report.readiness.outcome, meters: report.readiness.meters });

    // ---------- letters waiting for approval ----------
    const drafts = state.approvals.filter((x) => x.kind === 'email' && x.status !== 'rejected');
    if (drafts.length) {
      blocks.push({ id: 'letters', type: 'letters', drafts: drafts.map((d) => ({ approvalId: d.id, title: d.title, to: String((d.payload as any).to ?? ''), status: d.status })) });
    }

    // ---------- money ----------
    if (outputs.money?.output) blocks.push(budgetBlock(outputs.money.output));

    // ---------- where they could live ----------
    const housing = outputs.housing?.output as any;
    if (housing?.listings?.length) blocks.push(rentalsBlock(housing));

    // What is around where they are going, while they are still deciding whether to go.
    //
    // This was gated behind Germany mode, so the map only appeared once somebody had already
    // arrived — which is the one moment they no longer need it. "Is there an Indian shop, where is
    // the Bürgeramt, how far is the station" are questions people ask months before the flight, and
    // every alumnus says a version of "find the Indian shop in week one".
    const lifeNow = outputs.life?.output as any;
    // Empty categories are dropped rather than shown at zero: Overpass throttles, and a chip
    // reading "Pharmacies 0" says we looked and there are none, which is false and unhelpful.
    const lifeGroups = (lifeNow?.groups ?? []).filter((g: any) => g.places?.length);
    if (lifeGroups.length) {
      blocks.push({ id: 'places', type: 'places', city: lifeNow.city, center: lifeNow.center, groups: lifeGroups });
    }

    // ---------- timeline ----------
    const tl = timelineBlock(state);
    if (tl.items.length) blocks.push(tl);

    // ---------- is this real, and what is it actually like ----------
    const safety = outputs.safety?.output as any;
    if (safety?.scam) blocks.push(scamBlock(safety));
    if (safety?.reality) blocks.push(realityBlock(safety.reality));
    if (safety?.group) blocks.push(groupBlock(safety.group));
    const finance = safety?.finance as any;
    if (finance?.oneOff?.length) blocks.push(financeBlock(finance));
    if (safety?.rights) blocks.push(helpBlock(safety));

    // ---------- the cohort thread ----------
    if (state.community.length) blocks.push(communityBlock(state));
    // "People like you": how long each step took the people ahead of them on this route.
    if (state.cohort) blocks.push(cohortBlock(state.cohort));

    // ---------- services ----------
    if (route) blocks.push({ id: 'services', type: 'services', services: servicesForRoute(route, state.applicant.id) });

    if (processing) blocks.unshift({ id: 'reading-note', type: 'note', tone: 'info', title: 'Reading your files', body: 'Rows appear in your truth map as each file is read.' });

    return { blocks, mode, headline: templateHeadline(state, report), footnote: templateFootnote(state) };
  }

  /** Full composition: the agent orders blocks and writes the words. Falls back to templates. */
  async compose(state: ApplicantState, report: CheckReport, runId: string, useLlm: boolean): Promise<Screen> {
    const built = this.build(state, report);
    let { blocks, headline, footnote } = built;
    let composedBy: Screen['composedBy'] = 'rules';
    if (useLlm && built.mode !== 'onboarding' && this.llm.available) {
      const comp = await this.llm.json({
        task: 'compose_screen',
        tier: 'cheap',
        system: COMPOSER_SYSTEM,
        user: JSON.stringify(compositionInput(state, report, blocks)),
        schema: Composition,
        applicantId: state.applicant.id,
        runId,
        maxTokens: 2200,
      });
      if (comp) {
        ({ blocks, headline, footnote } = applyComposition(blocks, comp, headline, footnote));
        composedBy = 'agent';
      }
    } else {
      const last = await db.query.screens.findFirst({ where: eq(schema.screens.applicantId, state.applicant.id) });
      const prev = last?.data as unknown as Screen | undefined;
      if (prev?.composedBy === 'agent' && built.mode === prev.mode) {
        // Keep the agent's words and order, but only for blocks whose data has not changed since it wrote them.
        const strip = (b: Block) => {
          const { title: _t, body: _b, ...rest } = b as Block & { title?: string; body?: string };
          return JSON.stringify(rest);
        };
        const fresh = new Map(blocks.map((b) => [b.id, strip(b)]));
        const same = (b: Block) => fresh.get(b.id) === strip(b);
        const nextSame = prev.blocks.find((b) => b.id === 'next-step');
        const comp: Composition = {
          headline: nextSame && same(nextSame) ? prev.headline : headline,
          footnote: prev.footnote,
          order: prev.blocks.map((b) => b.id),
          copy: prev.blocks.filter((b) => (b.title || b.body) && same(b)).map((b) => ({ id: b.id, title: b.title ?? '', body: b.body ?? '' })),
        };
        ({ blocks, headline, footnote } = applyComposition(blocks, comp, headline, footnote, true));
        composedBy = 'agent';
      }
    }
    return this.save(state.applicant.id, { mode: built.mode, headline, footnote, blocks, composedBy }, runId);
  }

  private async save(applicantId: string, s: Omit<Screen, 'applicantId' | 'version' | 'updatedAt'>, runId: string): Promise<Screen> {
    const last = await db.query.screens.findFirst({ where: eq(schema.screens.applicantId, applicantId) });
    const blocks = rankForReading(s.blocks.map((b) => ({ ...b, section: b.section ?? sectionFor(b) })));
    const screen: Screen = { ...s, blocks, sections: sectionsOf(blocks), applicantId, version: (last?.version ?? 0) + 1, updatedAt: new Date().toISOString() };
    await db
      .insert(schema.screens)
      .values({ applicantId, version: screen.version, data: screen as unknown as Record<string, unknown> })
      .onConflictDoUpdate({ target: schema.screens.applicantId, set: { version: screen.version, data: screen as unknown as Record<string, unknown>, updatedAt: new Date() } });
    this.rt.toBoth(applicantId, { type: 'screen', screen });
    await this.trace.record('tool', 'compose_screen', { version: screen.version, blocks: screen.blocks.map((b) => b.type), by: screen.composedBy }, { applicantId, runId });
    return screen;
  }
}


/** Rooms and flats with the commute to whatever decides their day, and what fits the budget. */
function rentalsBlock(housing: any): Block {
  return {
    id: 'rentals',
    type: 'rentals',
    city: housing.city,
    center: housing.center,
    anchor: housing.anchor ?? null,
    budgetEur: housing.budgetEur ?? null,
    listings: (housing.listings ?? []).map((l: any) => ({
      id: l.id,
      title: l.title,
      district: l.district,
      kind: l.kind,
      warmRentEur: l.warmRentEur,
      sizeSqm: l.sizeSqm ?? null,
      lat: l.lat,
      lon: l.lon,
      commuteMin: l.commuteMin ?? null,
      url: l.url ?? null,
      mapsUrl: l.mapsUrl,
      directionsUrl: l.directionsUrl ?? undefined,
      affordable: l.affordable !== false,
      note: l.note,
    })),
    source: housing.listingSource ?? 'Educaro district averages',
  };
}


/** The cohort thread, newest first, with replies counted rather than inlined. */

/**
 * How long each step took the people ahead of them.
 *
 * `basis` is on the block, not hidden in a tooltip, because it is the difference between evidence
 * and an anecdote: three files is not a trend and the person reading has to be able to see that for
 * themselves.
 */
function cohortBlock(c: NonNullable<ApplicantState['cohort']>): Block {
  return {
    id: 'cohort',
    type: 'cohort',
    route: c.route,
    basis: c.basis,
    steps: c.steps,
    peers: c.peers,
  };
}

function communityBlock(state: ApplicantState): Block {
  const roots = state.community.filter((p) => !p.parentId).slice(0, 6);
  return {
    id: 'community',
    type: 'community',
    channel: state.applicant.cohortChannel ?? 'educaro-cohort',
    posts: roots.map((p) => ({
      id: p.id,
      author: p.author,
      authorKind: p.authorKind,
      text: p.text,
      createdAt: p.createdAt.toISOString(),
      replies: state.community.filter((r) => r.parentId === p.id).length,
      viaDiscord: p.viaDiscord,
    })),
  };
}


/** Is this university, employer or landlord real, and is the contract fair. */
function scamBlock(safety: any): Block {
  return {
    id: 'scam_check',
    type: 'scam_check',
    subject: safety.scam.subject,
    verdict: safety.scam.verdict,
    score: safety.scam.score,
    signals: safety.scam.signals ?? [],
    contractFlags: safety.contractFlags ?? [],
    neverDo: safety.scam.neverDo ?? [],
    contractKind: safety.contractKind ?? 'unknown',
    missing: safety.missing ?? [],
    registers: safety.scam.registers ?? [],
    pageOpened: safety.scam.pageOpened ?? false,
    checkedAt: safety.scam.checkedAt ?? undefined,
    history: safety.history ?? [],
  };
}

/** What the route is actually like, including the parts a brochure leaves out. */
function realityBlock(reality: any): Block {
  return {
    id: 'reality_check',
    type: 'reality_check',
    route: reality.route,
    headline: reality.headline,
    shifts: reality.shifts ?? [],
    money: reality.money ?? [],
    hard: reality.hard ?? [],
    voices: reality.voices ?? [],
    source: reality.source,
  };
}

/** Who else is going to the same city in the same month. */
function groupBlock(group: any): Block {
  return {
    id: 'cohort_group',
    type: 'cohort_group',
    city: group.city,
    month: group.month,
    members: group.members ?? [],
    flatShare: group.flatShare ?? null,
    travel: group.travel ?? null,
    joined: Boolean(group.joined),
  };
}

/** What they need before they can go, and when each piece lands. */
function financeBlock(plan: any): Block {
  return {
    id: 'finance_plan',
    type: 'finance_plan',
    currency: 'EUR',
    inrPerEur: plan.inrPerEur,
    oneOff: plan.oneOff ?? [],
    monthlyEur: plan.monthlyEur,
    needBeforeTravelEur: plan.needBeforeTravelEur,
    haveEur: plan.haveEur ?? null,
    fundingGapEur: plan.fundingGapEur ?? null,
    options: plan.options ?? [],
    rates: plan.rates,
    currencies: plan.currencies,
    sharing: plan.sharing ?? null,
  };
}

/** One tap when something is wrong, and the rights that apply whatever the contract says. */
function helpBlock(safety: any): Block {
  return {
    id: 'help',
    type: 'help',
    rights: safety.rights ?? [],
    contacts: safety.contacts ?? [],
    reportHint: 'Tell us privately if an employer treats you badly. It stays between you and Educaro, and it changes how we rate that employer for everyone who comes after you.',
  };
}

function budgetBlock(money: any): Block {
  return {
    id: 'budget',
    type: 'budget',
    city: money.city,
    lines: money.lines,
    total: money.total,
    compare: money.compare ?? [],
    sources: (money.sources ?? []).map((s: any) => ({ label: s.label, url: s.url })),
  };
}

function timelineBlock(state: ApplicantState): Extract<Block, { type: 'timeline' }> {
  const items: { date: string; label: string; kind: 'deadline' | 'exam' | 'task' | 'event' | 'interview' }[] = state.calendar.map((e) => ({
    date: e.startsAt.toISOString(),
    label: e.title,
    kind: e.kind,
  }));
  for (const s of state.shortlist) {
    const dl = (s.matrix as any)?.deadline;
    if (dl?.date) items.push({ date: dl.date, label: `${s.title}: application deadline`, kind: 'deadline' });
  }
  items.sort((a, b) => a.date.localeCompare(b.date));
  return { id: 'timeline', type: 'timeline', items };
}

function templateHeadline(state: ApplicantState, report: CheckReport): string {
  const a = state.applicant;
  const first = a.name.split(/\s+/)[0];
  const route = a.route as Route | null;
  if (!state.files.some((f) => f.status === 'done')) return `${first}, tell us your story. One short video and your documents are all we need to start.`;
  if (state.files.some((f) => f.status === 'queued' || f.status === 'reading')) return `${first}, I'm reading your files now. Your truth map fills in as I go.`;
  if (!route) return `${first}, I've read your story. Two routes look possible; tell me which matters more to you.`;
  if (route === 'nursing') {
    const q = bestFact(state, 'education.highest')?.value ?? 'nursing diploma';
    const l = report.language;
    const g = l.need && (!l.proven || l.proven < l.need);
    return `${first}, your ${q.split(',')[0]} can be recognised in Germany.${g ? ` German is your long pole: you need ${l.need}${l.final && l.final !== l.need ? `, then ${l.final} for nursing` : ''}.` : ''}`;
  }
  if (route === 'study') {
    const g = factData(state, 'education.grade');
    const raw = String(g.raw ?? bestFact(state, 'education.grade')?.value ?? '');
    const conv = convertIndianGrade(raw, g.scaleMax, g.passMin);
    const aps = report.gaps.find((x) => x.key === 'aps');
    return `${first}, ${conv ? `your ${raw.match(/\d+(\.\d+)?/)?.[0]} ${/%/.test(raw) ? 'percent' : 'CGPA'} is ${conv.german.toFixed(1)} on the German scale. ` : ''}${aps ? 'Start APS verification this week. Every application waits for it.' : report.gaps[0] ? `${report.gaps[0].title}.` : 'You are ready to apply.'}`;
  }
  const top = report.gaps[0];
  return `${first}, ${ROUTE_LABEL[route]} fits you best.${top ? ` Next: ${midSentence(top.title)}.` : ''}`;
}

function templateFootnote(state: ApplicantState): string {
  const fam = bestFact(state, 'family.germany');
  const d = (fam?.data ?? {}) as any;
  if (fam && d.city && state.applicant.route !== 'study') return `Your ${d.relation ?? 'family'} lives in ${d.city}, so partner employers near ${d.city} show first.`;
  const money = state.outputs.money?.output;
  if (money?.compare?.length) {
    const hi = [...money.compare, { city: money.city, total: money.total }].sort((x: any, y: any) => y.total - x.total);
    if (hi.length > 1 && hi[0].total - hi[hi.length - 1].total > 100) return `${hi[0].city} costs about €${hi[0].total - hi[hi.length - 1].total} a month more than ${hi[hi.length - 1].city}. The budget comparison is below.`;
  }
  return '';
}

function compositionInput(state: ApplicantState, report: CheckReport, blocks: Block[]) {
  const a = state.applicant;
  const facts = state.facts
    .filter((f) => !(f.data as any)?.sensitive && !f.key.startsWith('official.') && !f.key.startsWith('contact.'))
    .slice(-30)
    .map((f) => `${f.label}: ${f.value} [${f.tag}]`);
  return {
    applicant: { firstName: a.name.split(/\s+/)[0], route: a.route ? ROUTE_LABEL[a.route as Route] : null, city: a.targetCity },
    facts,
    readiness: report.readiness.overall,
    topGaps: report.gaps.slice(0, 4).map((g) => g.title),
    blocks: blocks.map((b) => ({ id: b.id, type: b.type, summary: summarize(b) })),
  };
}

function summarize(b: Block): string {
  switch (b.type) {
    case 'next_step':
      return `${b.title}: ${b.body}`;
    case 'question':
      return b.prompt;
    case 'truth_map':
      return b.rows.map((r) => `${r.label}=${r.status}`).join('; ');
    case 'checklist':
      return b.items.map((i) => `${i.label}:${i.status}`).join('; ');
    case 'gap_plan':
      return b.gaps.map((g) => g.title).join('; ');
    case 'readiness':
      return `${b.overall}% ${b.outcome}`;
    case 'budget':
      return `€${b.total}/month in ${b.city}`;
    case 'shortlist':
      return b.items.map((i) => `${i.title} (${i.gapCount} gaps)`).join('; ');
    case 'requirement_matrix':
      return b.rows.map((r) => `${r.requirement}:${r.status}`).join('; ');
    case 'opportunities':
      return b.items.map((i) => i.title).join('; ');
    case 'route':
      return `${b.primary}; ${b.reasons.join('; ')}`;
    case 'documents':
      return `${b.items.length} files`;
    case 'timeline':
      return b.items.map((i) => i.label).slice(0, 4).join('; ');
    case 'services':
      return b.services.map((s) => s.name).join('; ');
    default:
      return b.type;
  }
}

/** Apply the agent's order and words. Unknown ids are ignored; question blocks can never be hidden. */
function applyComposition(blocks: Block[], comp: Composition, headline: string, footnote: string, keepUnordered = true) {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const ordered: Block[] = [];
  for (const id of comp.order) {
    const b = byId.get(id);
    if (b && !ordered.includes(b)) ordered.push(b);
  }
  for (const b of blocks) {
    if (ordered.includes(b)) continue;
    if (b.type === 'question') ordered.splice(Math.min(1, ordered.length), 0, b);
    else if (keepUnordered) ordered.push(b);
  }
  const copy = new Map(comp.copy.map((c) => [c.id, c]));
  const out = ordered.map((b) => {
    const c = copy.get(b.id);
    if (!c) return b;
    // The agent writes titles and bodies; data fields stay untouched. Questions keep their exact prompt.
    if (b.type === 'question') return { ...b, title: c.title || b.title };
    return { ...b, title: c.title || b.title, body: c.body || b.body };
  });
  return { blocks: out, headline: comp.headline || headline, footnote: comp.footnote ?? footnote };
}

export { daysUntil };


/**
 * Where each block lives.
 *
 * One page stopped being able to hold this a while ago, and a block with no home is a feature
 * nobody finds — which is the same as not having built it. The API decides, because the API is what
 * knows a block exists at all: add a block type here and it appears in the right place without a
 * matching change on the web side.
 */
function sectionFor(b: Block): SectionId {
  switch (b.type) {
    // What to do next, and what is in the way of it.
    case 'next_step':
    case 'question':
    case 'readiness':
    case 'note':
      return 'home';
    case 'route':
    case 'gap_plan':
    case 'checklist':
    case 'timeline':
    case 'opportunities':
    case 'shortlist':
    case 'requirement_matrix':
    case 'reality_check':
      return 'plan';
    case 'documents':
    case 'truth_map':
      return 'papers';
    case 'budget':
    case 'finance_plan':
      return 'money';
    case 'places':
    case 'rentals':
    case 'arrival':
    case 'services':
      return 'life';
    case 'scam_check':
    case 'help':
      return 'safety';
    case 'community':
    case 'cohort':
    case 'cohort_group':
      return 'community';
    case 'letters':
      return 'inbox';
    default:
      return 'home';
  }
}

/** The sections that actually have something in them, in a fixed reading order. */
const SECTION_ORDER: SectionId[] = ['home', 'plan', 'papers', 'money', 'life', 'safety', 'community', 'inbox'];

function sectionsOf(blocks: Block[]): ScreenSection[] {
  return SECTION_ORDER.map((id) => {
    const mine = blocks.filter((b) => (b.section ?? 'home') === id);
    return {
      id,
      label: SECTION_LABEL[id],
      blockIds: mine.map((b) => b.id),
      // Only things that are genuinely waiting on the person, so a dot always means "do something".
      needsAttention: mine.some(
        (b) =>
          b.type === 'question' ||
          (b.type === 'scam_check' && b.verdict === 'high_risk') ||
          (b.type === 'letters' && b.drafts.some((d) => d.status === 'pending')),
      ),
    };
  }).filter((sec) => sec.blockIds.length > 0);
}


/**
 * The reading order, enforced in code after the agent has had its say.
 *
 * The agent is good at deciding what matters today and bad at knowing when it has asked for too
 * much at once. Four things demanding a decision — a next step, two questions and a letter to
 * approve — is a screen somebody acts on. Six is a screen somebody closes, and the jury's note
 * about the interface was exactly this.
 *
 * So the model still chooses the order; the cap is not negotiable. Anything past the fourth
 * demanding block drops below the calm ones rather than being removed, because the agent asked for
 * it for a reason and hiding it would be a different kind of dishonest.
 */
const DEMANDING = new Set<Block['type']>(['next_step', 'question', 'letters', 'note']);
const MAX_DEMANDING_ABOVE_FOLD = 4;

/** Low-urgency by nature: worth having, never worth interrupting for. */
const CALM = new Set<Block['type']>(['rentals', 'places', 'cohort', 'cohort_group', 'community', 'services', 'reality_check']);

function rankForReading(blocks: Block[]): Block[] {
  const demanding: Block[] = [];
  const normal: Block[] = [];
  const calm: Block[] = [];
  const overflow: Block[] = [];

  for (const b of blocks) {
    if (DEMANDING.has(b.type)) {
      (demanding.length < MAX_DEMANDING_ABOVE_FOLD ? demanding : overflow).push(b);
    } else if (CALM.has(b.type)) {
      calm.push(b);
    } else {
      normal.push(b);
    }
  }
  // Readiness is the summary everything else explains, so the calm blocks sit after it.
  const readinessAt = normal.findIndex((b) => b.type === 'readiness');
  const beforeCalm = readinessAt >= 0 ? normal.slice(0, readinessAt + 1) : normal;
  const afterReadiness = readinessAt >= 0 ? normal.slice(readinessAt + 1) : [];
  return [...demanding, ...beforeCalm, ...afterReadiness, ...calm, ...overflow];
}
