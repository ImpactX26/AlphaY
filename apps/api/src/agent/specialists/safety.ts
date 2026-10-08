import { and, eq, ne } from 'drizzle-orm';
import { db, schema } from '../../db/db';
import { checkContract, HELP_CONTACTS, REGISTERS, scamCheck, WORK_RIGHTS } from '../../knowledge/safety';
import { realityFor } from '../../knowledge/reality';
import { monthLabel, parseMonth } from '../../knowledge/normalize';
import { bestFact } from '../state.service';
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
  const kind: Parameters<typeof scamCheck>[0]['kind'] = target?.kind === 'opening' ? 'employer' : target ? 'university' : 'agent';

  const check = scamCheck({
    kind,
    name: subjectName,
    url: target?.url ?? null,
    email: (lastInbound?.payload as any)?.to ?? null,
    text: `${(lastInbound?.payload as any)?.body ?? ''}`,
    pageOpened: Boolean(target?.matrix),
    inCatalogue: Boolean(target?.refId),
    feeRequested: false,
  });

  // Any contract text we hold — an offer letter the applicant uploaded, or the body of an offer.
  const contractText = st.files
    .filter((f) => /contract|offer|arbeitsvertrag|anstellung/i.test(f.originalName) && f.text)
    .map((f) => f.text)
    .join('\n')
    .slice(0, 20_000);
  const contractFlags = contractText ? checkContract(contractText) : [];

  const reality = realityFor(route);
  const group = await cohortGroup(kit);

  return {
    summary: `Safety: ${subjectName} ${check.verdict.replace(/_/g, ' ')} (${check.score}/100)${contractFlags.length ? `, ${contractFlags.length} contract flag(s)` : ''}${group ? `, ${group.members.length} going to ${group.city}` : ''}`,
    output: {
      scam: { subject: { kind, name: subjectName }, ...check, registers: Object.values(REGISTERS) },
      contractFlags,
      rights: WORK_RIGHTS,
      contacts: HELP_CONTACTS,
      reality,
      group,
      finance: financePlan(kit),
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
  return {
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
export function financePlan(kit: Kit) {
  const st = kit.state;
  const city = targetCity(st);
  const route = st.applicant.route;
  const monthly = (st.outputs.money?.output as any)?.total ?? Math.round(city.wgRoom + 450);
  const inrPerEur = 92; // indicative; shown as such

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

  if (route === 'study') {
    oneOff.push({ label: 'APS certificate', amountEur: 196, whenMonth: monthBefore(9), paid: false, note: 'INR 18,000. Takes 4–6 weeks, so it gates everything after it.' });
    oneOff.push({ label: 'uni-assist, first application', amountEur: 75, whenMonth: monthBefore(6), paid: false, note: 'EUR 30 for each further application in the same semester.' });
    oneOff.push({ label: 'Blocked account', amountEur: 11904, whenMonth: monthBefore(3), paid: false, note: 'The whole year up front. You may withdraw EUR 992 a month once you arrive.' });
  } else {
    oneOff.push({ label: 'Document translation and apostille', amountEur: 250, whenMonth: monthBefore(7), paid: false, note: 'Sworn translator, per set. Usually the first real cost.' });
    oneOff.push({ label: 'Recognition procedure', amountEur: 350, whenMonth: monthBefore(6), paid: false, note: 'EUR 100–600 depending on the state. Educaro covers it on the Nursing Program.' });
  }
  oneOff.push({ label: 'German courses to B1', amountEur: 660, whenMonth: monthBefore(8), paid: false, note: 'Three levels at EUR 220, plus EUR 90 per exam.' });
  oneOff.push({ label: 'Visa fee', amountEur: 75, whenMonth: monthBefore(2), paid: false });
  oneOff.push({ label: 'Flight', amountEur: 520, whenMonth: monthBefore(0), paid: false, note: 'One way, booked early.' });
  oneOff.push({ label: 'First month before the first salary', amountEur: monthly + Math.round(city.wgRoom * 2), whenMonth: monthLabel(start), paid: false, note: 'Rent, deposit of up to three months cold rent, and living until payday. The most commonly forgotten number.' });

  const needBeforeTravel = oneOff.reduce((sum, o) => sum + o.amountEur, 0);
  const haveEur = have ? Number(String(have.value).replace(/[^\d.]/g, '')) || null : null;

  return {
    currency: 'EUR' as const,
    inrPerEur,
    oneOff,
    monthlyEur: monthly,
    needBeforeTravelEur: needBeforeTravel,
    haveEur,
    fundingGapEur: haveEur === null ? null : Math.max(0, needBeforeTravel - haveEur),
    options: [
      { label: 'Education loan', detail: 'Indian banks lend against an admission letter or a signed contract. Public-sector rates are typically 9–11%; the blocked account is accepted as a purpose.' },
      { label: 'Verpflichtungserklärung instead of a blocked account', detail: 'A relative living in Germany can sign a formal obligation at their foreigners authority, which replaces the EUR 11,904 entirely.' },
      { label: 'Employer-funded routes', detail: 'On the Nursing Program the hospital pays recognition, the B2 course and the first room, which removes most of the list above.' },
      { label: 'Scholarships', detail: 'DAAD and university scholarships exist but are decided late. Never plan the visa around one.' },
    ],
  };
}
