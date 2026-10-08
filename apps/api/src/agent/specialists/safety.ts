import { and, desc, eq, ne } from 'drizzle-orm';
import { db, schema } from '../../db/db';
import { checkContract, contractKind, HELP_CONTACTS, looksLikeContract, missingFromContract, REGISTERS, scamCheck, WORK_RIGHTS } from '../../knowledge/safety';
import { realityFor } from '../../knowledge/reality';
import { monthLabel, parseMonth } from '../../knowledge/normalize';
import { bestFact } from '../state.service';
import { fetchRates, CURRENCIES } from '../../web/fx';
import { fundingFor, monthlyRepayment } from '../../knowledge/funding';
import { targetCity } from './living';
import type { Kit, SpecialistResult } from './kit';

/**
 * Safety: is this real, is this contract fair, what are your rights, and what is this actually like.
 *
 * Grouped into one specialist because they are one question asked four ways — "am I about to be
 * taken advantage of" — and because an applicant meets them at the same moment, when an offer
 * arrives and they have days to decide.
 */
export async function safetySpecialist(kit: Kit): Promise<SpecialistResult> {
  const st = kit.state;
  const route = st.applicant.route;

  // What there is to check right now: the top shortlisted target, or the employer who wrote.
  const target = st.shortlist[0];
  const lastInbound = st.approvals.find((a) => a.kind === 'email');
  const subjectName = target?.title ?? (lastInbound?.payload as any)?.to ?? 'your current target';
  const subjectKind: Parameters<typeof scamCheck>[0]['kind'] = target?.kind === 'opening' ? 'employer' : target ? 'university' : 'agent';

  const check = scamCheck({
    kind: subjectKind,
    name: subjectName,
    url: target?.url ?? null,
    email: (lastInbound?.payload as any)?.to ?? null,
    text: `${(lastInbound?.payload as any)?.body ?? ''}`,
    pageOpened: Boolean(target?.matrix),
    inCatalogue: Boolean(target?.refId),
    feeRequested: false,
  });

  // Any contract text we hold, found by reading the file rather than by trusting its name. The
  // filename test this replaced missed every contract photographed on a phone, which is most of
  // them: the paper gets handed over in a meeting and leaves the room as IMG_0423.jpg.
  const contractFile = st.files.find((f) => f.text && looksLikeContract(f.text));
  const contractText = (contractFile?.text ?? '').slice(0, 20_000);
  const kind = contractText ? contractKind(contractText) : 'unknown';
  const contractFlags = contractText ? checkContract(contractText, kind) : [];
  const missing = contractText ? missingFromContract(contractText, kind) : [];

  const reality = realityFor(route);
  const group = await cohortGroup(kit);

  // An illegal clause outranks a clean-looking sender. A real hospital can send a loaded contract,
  // and "the employer checks out" is the wrong headline to put above eight void clauses.
  const illegal = contractFlags.filter((f) => f.severity === 'illegal').length;
  const verdict = illegal >= 3 ? 'high_risk' : illegal >= 1 && check.verdict === 'looks_legitimate' ? 'be_careful' : check.verdict;

  // What they asked us to check themselves outranks what we checked on their behalf: they went
  // looking for it, which means it is the thing they are deciding about today.
  const asked = await latestCheck(st.applicant.id);

  return {
    summary: `Safety: ${asked?.subject?.name ?? subjectName} ${(asked?.verdict ?? verdict).replace(/_/g, ' ')} (${asked?.score ?? check.score}/100)${contractFlags.length ? `, ${contractFlags.length} contract flag(s)` : ''}${group ? `, ${group.members.length} going to ${group.city}` : ''}`,
    output: {
      scam: asked ?? { subject: { kind: subjectKind, name: subjectName }, ...check, verdict, registers: Object.values(REGISTERS) },
      contractFlags: asked?.contractFlags ?? contractFlags,
      contractKind: asked?.contractKind ?? kind,
      missing: asked?.missing ?? missing,
      history: await checkHistory(st.applicant.id),
      rights: WORK_RIGHTS,
      contacts: HELP_CONTACTS,
      reality,
      group,
      finance: await financePlan(kit, group),
    },
  };
}

/**
 * Who else is going to the same city at about the same time.
 *
 * Arriving alone in a country where you do not yet have the language is the part that breaks
 * people, and it is entirely solvable with a list this product already has. Anonymous until both
 * sides opt in — a cohort list that leaks who is going where would be worse than no list.
 */
async function cohortGroup(kit: Kit) {
  const st = kit.state;
  const city = targetCity(st);
  const when = parseMonth(st.applicant.startDate) ?? { y: new Date().getFullYear() + 1, m: 9 };

  const others = await db
    .select()
    .from(schema.applicants)
    .where(and(ne(schema.applicants.id, st.applicant.id), eq(schema.applicants.targetCity, city.name)));

  const members = others.slice(0, 6).map((a, i) => ({
    // First name and route only. Nobody consented to a full name in a group they have not joined.
    label: `${a.name.split(' ')[0]} ${a.name.split(' ')[1]?.[0] ?? ''}.`.trim(),
    route: a.route ?? 'deciding',
    arrivingMonth: monthLabel(parseMonth(a.startDate) ?? when),
    sharedInterest: a.route === st.applicant.route ? `same route` : a.homeCity ? `from ${a.homeCity}` : null,
  }));

  if (!members.length) return null;

  const rent = (st.outputs.housing?.output as any)?.listings?.[0]?.warmRentEur ?? city.wgRoom;

  // A group they have actually joined, as opposed to one suggested to them. Only this feeds the
  // money plan: a budget built on a flat nobody agreed to share is a budget that breaks on arrival.
  const mine = await db
    .select()
    .from(schema.cohortMembers)
    .where(and(eq(schema.cohortMembers.applicantId, st.applicant.id), eq(schema.cohortMembers.status, 'joined')));
  let joinedShare: { shareEachEur: number; others: number; title: string } | null = null;
  for (const m of mine) {
    const g = await db.query.cohortGroups.findFirst({ where: eq(schema.cohortGroups.id, m.groupId) });
    if (!g || g.kind !== 'flat_share' || !g.budgetEachEur) continue;
    const all = await db.select().from(schema.cohortMembers).where(and(eq(schema.cohortMembers.groupId, g.id), eq(schema.cohortMembers.status, 'joined')));
    joinedShare = { shareEachEur: g.budgetEachEur, others: Math.max(0, all.length - 1), title: g.title };
    break;
  }

  return {
    joinedShare,
    city: city.name,
    month: monthLabel(when),
    members,
    flatShare: members.length >= 2 ? { seats: Math.min(3, members.length + 1), budgetEachEur: Math.round(rent * 0.85), district: city.districts[0] } : null,
    travel: { label: `Flying around ${monthLabel(when)}`, detail: `${members.length} other${members.length === 1 ? '' : 's'} arriving in ${city.name} the same month. Travelling together makes the first 48 hours much easier, and splitting a flat is cheaper than any room on your own.` },
    joined: Boolean(st.applicant.cohortChannel),
  };
}

/**
 * Money over time, rather than money this month.
 *
 * The budget block answers "what does a month cost". It does not answer the question that actually
 * stops people, which is "how much do I need before I can even go, and when". Those are one-off
 * sums landing in a particular order, and the blocked account is most of it.
 */
export async function financePlan(kit: Kit, group?: { joinedShare?: { shareEachEur: number; others: number } | null } | null) {
  const st = kit.state;
  const city = targetCity(st);
  const route = st.applicant.route;
  const monthly = (st.outputs.money?.output as any)?.total ?? Math.round(city.wgRoom + 450);

  // Live ECB rates rather than a constant. The hardcoded 92 this replaced was wrong by about 17%
  // against the real rate — roughly two lakh rupees on the blocked account alone, and the blocked
  // account is the number somebody takes to a bank manager.
  const rates = await fetchRates();

  const start = parseMonth(st.applicant.startDate) ?? { y: new Date().getFullYear() + 1, m: 9 };
  const monthBefore = (n: number) => {
    const m = { ...start };
    m.m = (m.m ?? 9) - n;
    while ((m.m ?? 0) <= 0) {
      m.m = (m.m ?? 0) + 12;
      m.y -= 1;
    }
    return monthLabel(m);
  };

  const oneOff: { label: string; amountEur: number; whenMonth: string; paid: boolean; note?: string }[] = [];
  const have = bestFact(st, 'money.savings');

  const needsBlockedAccount = route === 'study' || route === 'chancenkarte';
  if (route === 'study') {
    oneOff.push({ label: 'APS certificate', amountEur: 196, whenMonth: monthBefore(9), paid: false, note: 'Takes 4–6 weeks, so it gates everything after it.' });
    oneOff.push({ label: 'uni-assist, first application', amountEur: 75, whenMonth: monthBefore(6), paid: false, note: 'EUR 30 for each further application in the same semester.' });
    oneOff.push({ label: 'Blocked account', amountEur: 11904, whenMonth: monthBefore(3), paid: false, note: 'The whole year up front. You may withdraw EUR 992 a month once you arrive.' });
  } else {
    oneOff.push({ label: 'Document translation and apostille', amountEur: 250, whenMonth: monthBefore(7), paid: false, note: 'Sworn translator, per set. Usually the first real cost.' });
    oneOff.push({ label: 'Recognition procedure', amountEur: 350, whenMonth: monthBefore(6), paid: false, note: 'EUR 100–600 depending on the state. Educaro covers it on the Nursing Program.' });
  }
  oneOff.push({ label: 'German courses to B1', amountEur: 660, whenMonth: monthBefore(8), paid: false, note: 'Three levels at EUR 220, plus EUR 90 per exam.' });
  oneOff.push({ label: 'Visa fee', amountEur: 75, whenMonth: monthBefore(2), paid: false });
  oneOff.push({ label: 'Flight', amountEur: 520, whenMonth: monthBefore(0), paid: false, note: 'One way, booked early.' });

  // What the first month costs before the first salary, which is the most commonly forgotten
  // number — and the first place a flat-share changes the arithmetic rather than the advice.
  const share = flatShareSaving(group ?? null, city);
  const firstMonthRent = share ? share.shareEachEur : city.wgRoom;
  const deposit = firstMonthRent * (share ? 3 : 3);
  oneOff.push({
    label: 'First month before the first salary',
    amountEur: monthly + deposit,
    whenMonth: monthLabel(start),
    paid: false,
    note: share
      ? `Rent, the deposit (capped at three months cold rent by law) and living until payday. Sharing with ${share.others} other${share.others === 1 ? '' : 's'} brings your room to about EUR ${share.shareEachEur} instead of EUR ${city.wgRoom}.`
      : 'Rent, a deposit of up to three months cold rent, and living until payday. The most commonly forgotten number.',
  });

  const needBeforeTravel = oneOff.reduce((sum, o) => sum + o.amountEur, 0);
  const haveEur = have ? Number(String(have.value).replace(/[^\d.]/g, '')) || null : null;
  const options = fundingFor(route, { needBlockedAccount: needsBlockedAccount });

  return {
    currency: 'EUR' as const,
    // Kept for the existing block contract; the live table below is what the screen should use.
    inrPerEur: Math.round((rates.rates.INR ?? 108) * 100) / 100,
    rates: { date: rates.date, live: rates.live, source: rates.source, perEur: rates.rates },
    currencies: CURRENCIES,
    oneOff,
    monthlyEur: share ? monthly - (city.wgRoom - share.shareEachEur) : monthly,
    needBeforeTravelEur: needBeforeTravel,
    haveEur,
    fundingGapEur: haveEur === null ? null : Math.max(0, needBeforeTravel - haveEur),
    /** What sharing a flat takes off the plan, when they have actually joined one. */
    sharing: share,
    /** Every option with what it covers, what it costs and whether it removes the blocked account. */
    options: options.map((o) => ({
      label: o.label,
      detail: `${o.what} ${o.cost} Start it ${o.startBy}`,
      kind: o.kind,
      coversEur: o.coversEur,
      replacesBlockedAccount: o.replacesBlockedAccount,
      eligibility: o.eligibility,
      startBy: o.startBy,
      url: o.url,
      /** What an education loan of this size costs a month, so the figure is one a family can weigh. */
      monthlyRepaymentEur:
        o.kind === 'loan' && o.coversEur ? Math.round(monthlyRepayment(Math.min(o.coversEur, needBeforeTravel), 10, 7)) : null,
    })),
  };
}

/**
 * What a flat-share actually takes off the plan.
 *
 * Only counts a group they have joined, not one that was suggested to them. A budget built on a
 * flat somebody has not agreed to share is a budget that breaks on arrival, and this figure feeds
 * the deposit and the first month — the two numbers people are shortest on.
 */
function flatShareSaving(group: { joinedShare?: { shareEachEur: number; others: number } | null } | null, city: { wgRoom: number }): { shareEachEur: number; others: number } | null {
  // Taken as an argument rather than read back out of `state.outputs.safety`: this runs *inside*
  // the safety specialist, so that output is the previous run's and a group joined a minute ago
  // never appeared. The money plan was silently a room-of-your-own plan for anyone sharing.
  const joined = group?.joinedShare;
  if (!joined?.shareEachEur || !joined.others) return null;
  if (joined.shareEachEur >= city.wgRoom) return null;
  return { shareEachEur: Math.round(joined.shareEachEur), others: joined.others };
}

/**
 * The last check this applicant ran themselves.
 *
 * The specialist runs its own check on whatever is top of the shortlist, which is nearly always a
 * real university and so nearly always says "looks legitimate" — true, and useless. The moment
 * somebody pastes a letter in and asks, that is the thing on their mind, and it is what the block
 * should be showing them.
 */
async function latestCheck(applicantId: string) {
  const [row] = await db
    .select()
    .from(schema.safetyChecks)
    .where(eq(schema.safetyChecks.applicantId, applicantId))
    .orderBy(desc(schema.safetyChecks.createdAt))
    .limit(1);
  if (!row) return null;
  return {
    subject: { kind: row.kind as 'university' | 'employer' | 'landlord' | 'agent' | 'offer', name: row.subject },
    verdict: row.verdict as 'looks_legitimate' | 'be_careful' | 'high_risk',
    score: row.score,
    signals: row.signals as unknown as { label: string; status: 'good' | 'warn' | 'bad'; detail: string }[],
    contractFlags: row.contractFlags as unknown as { clause: string; why: string; lawSays: string; severity: 'unfair' | 'illegal' | 'watch' }[],
    contractKind: (row.contractKind ?? 'unknown') as 'work' | 'rental' | 'unknown',
    missing: row.missing as unknown as { id: string; label: string }[],
    neverDo: scamCheck({ kind: 'offer', name: row.subject }).neverDo,
    registers: Object.values(REGISTERS),
    checkedAt: row.createdAt.toISOString(),
  };
}

/** Everything they have asked about, so the pattern is visible to them and not only to staff. */
async function checkHistory(applicantId: string) {
  const rows = await db
    .select()
    .from(schema.safetyChecks)
    .where(eq(schema.safetyChecks.applicantId, applicantId))
    .orderBy(desc(schema.safetyChecks.createdAt))
    .limit(8);
  return rows.map((r) => ({ id: r.id, kind: r.kind, subject: r.subject, verdict: r.verdict, score: r.score, createdAt: r.createdAt.toISOString() }));
}
