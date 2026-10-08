/**
 * How the money actually gets found.
 *
 * The finance block listed four generic options as prose — "education loan", "scholarships" — which
 * is the same advice an agent gives for free and nobody can act on. The questions people actually
 * have are narrower and have answers: how much will a bank lend against an admission letter, what
 * does it cost per month, will a German bank lend to me at all before I arrive, and does any of
 * this remove the blocked account.
 *
 * So each option carries what it covers, what it costs, when it has to be started, and — the part
 * that matters most — whether it replaces the blocked account or merely funds it. A scholarship
 * that pays EUR 934 a month is not the same kind of thing as a loan that pays the lump sum, and
 * treating them as one list is why people arrive having organised neither.
 *
 * Figures are from the published schemes as checked in `research/knowledge.md`, and every one is
 * labelled with where it came from. Rates move: they are stated as ranges, not promises.
 */

export type FundingKind = 'loan' | 'scholarship' | 'guarantee' | 'employer' | 'family';

export interface FundingOption {
  id: string;
  kind: FundingKind;
  label: string;
  /** One sentence on what it is. */
  what: string;
  /** Roughly what it provides, in euro, where that is knowable. */
  coversEur: number | null;
  /** What it costs, or "none" for a grant. */
  cost: string;
  /** When they have to start it, relative to departure. */
  startBy: string;
  /** Does this remove the blocked-account requirement, or only pay for it? */
  replacesBlockedAccount: boolean;
  /** Who it is actually available to. Being honest here saves a wasted month. */
  eligibility: string;
  url: string | null;
  routes: string[];
}

const ALL = ['study', 'nursing', 'ausbildung', 'skilled_job', 'chancenkarte'];

export const FUNDING: FundingOption[] = [
  {
    id: 'indian-education-loan',
    kind: 'loan',
    label: 'Indian education loan (public-sector bank)',
    what: 'A loan against your admission letter or signed contract. The blocked account is an accepted purpose, and most public-sector banks have a standard product for it.',
    coversEur: 20000,
    cost: 'Typically 9–11% a year. Up to INR 7.5 lakh is usually unsecured; above that banks ask for collateral. Repayment starts 6–12 months after the course ends.',
    startBy: '3–4 months before departure — sanction takes 3 to 6 weeks and the blocked account cannot be opened without the funds.',
    replacesBlockedAccount: false,
    eligibility: 'Needs a confirmed admission or a signed employment contract. A co-applicant, usually a parent, is almost always required.',
    url: 'https://www.vidyalakshmi.co.in/',
    routes: ALL,
  },
  {
    id: 'verpflichtungserklaerung',
    kind: 'guarantee',
    label: 'Verpflichtungserklärung (a relative sponsors you)',
    what: 'A relative already living in Germany signs a formal undertaking at their local foreigners authority to cover your living costs. It replaces the blocked account outright.',
    coversEur: 11904,
    cost: 'Around EUR 29 for the declaration. No interest, because it is not a loan — but it is a real legal liability for whoever signs it.',
    startBy: '2–3 months before the visa appointment. The sponsor does it in Germany, not you.',
    replacesBlockedAccount: true,
    eligibility: 'The sponsor must show enough income to support both households. In practice a full-time salary of roughly EUR 2,500 net or more, which a nurse or engineer in Germany usually clears.',
    url: 'https://www.make-it-in-germany.com/en/visa-residence/types/declaration-of-commitment',
    routes: ALL,
  },
  {
    id: 'daad-scholarship',
    kind: 'scholarship',
    label: 'DAAD scholarship',
    what: 'The German government scholarship for international students. Pays a monthly stipend plus travel and insurance, and a DAAD award satisfies the visa financing requirement on its own.',
    coversEur: 11208,
    cost: 'None. It is a grant.',
    startBy: '10–12 months before the semester starts. Deadlines are usually in the autumn for the following winter, and they do not move.',
    replacesBlockedAccount: true,
    eligibility: 'Competitive, and decided late. A strong academic record and usually some professional experience. Never plan a visa around one — apply, and fund it as though you will not get it.',
    url: 'https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/',
    routes: ['study'],
  },
  {
    id: 'deutschlandstipendium',
    kind: 'scholarship',
    label: 'Deutschlandstipendium',
    what: 'EUR 300 a month for at least two semesters, awarded by the university itself rather than by a central body. Half comes from a private sponsor, half from the federal government.',
    coversEur: 3600,
    cost: 'None.',
    startBy: 'Usually applied for after you have a place, in the first weeks of the semester. Each university runs its own round.',
    replacesBlockedAccount: false,
    eligibility: 'Open to international students already enrolled. Merit-based but also weighs social background and personal circumstances, so it is worth applying to.',
    url: 'https://www.deutschlandstipendium.de/',
    routes: ['study'],
  },
  {
    id: 'employer-funded-nursing',
    kind: 'employer',
    label: 'Employer-funded placement (Educaro Nursing Program)',
    what: 'The hospital pays the recognition procedure, the B2 course and the first months of accommodation, and the contract itself satisfies the visa financing requirement.',
    coversEur: 9000,
    cost: 'None up front. Some employers ask for a repayment if you leave within a period — read that clause before signing, and run it through the contract check first.',
    startBy: 'As soon as recognition is in progress. The matching is what takes the time, not the funding.',
    replacesBlockedAccount: true,
    eligibility: 'Recognised or in-progress nursing qualification, and German at B1 heading to B2.',
    url: null,
    routes: ['nursing', 'ausbildung'],
  },
  {
    id: 'ausbildung-salary',
    kind: 'employer',
    label: 'The Ausbildung salary itself',
    what: 'A training contract pays from day one — roughly EUR 1,340 a month in the first year — and the contract is what the visa is granted against, so no blocked account is needed.',
    coversEur: 16080,
    cost: 'None, but it is a low income for three years. Plan that honestly with your family before you go.',
    startBy: 'The contract has to be signed before the visa appointment.',
    replacesBlockedAccount: true,
    eligibility: 'A signed Ausbildung contract and German at B1.',
    url: 'https://www.make-it-in-germany.com/en/training-learning/vocational-training',
    routes: ['ausbildung'],
  },
  {
    id: 'student-job',
    kind: 'family',
    label: 'Working alongside your studies',
    what: '20 hours a week during term, or 140 full days a year. A student job pays about EUR 13–15 an hour, so roughly EUR 450–700 a month after tax.',
    coversEur: 6000,
    cost: 'None financially. It costs study time, and the single biggest reason international students do not finish is the self-directed study, not the subject.',
    startBy: 'After arrival. Do not count on it for the visa — the authorities will not.',
    replacesBlockedAccount: false,
    eligibility: 'Any student visa. It does not reduce the blocked-account figure by a cent.',
    url: null,
    routes: ['study', 'chancenkarte'],
  },
  {
    id: 'german-bank-loan',
    kind: 'loan',
    label: 'A loan from a German bank',
    what: 'Worth knowing before you plan around it: German banks essentially do not lend to someone who has not yet arrived, has no Schufa record and no German income.',
    coversEur: null,
    cost: 'Not applicable before arrival. After about a year of German payslips and a Schufa file, ordinary consumer rates of roughly 5–8% become available.',
    startBy: 'Not before you arrive. Fund the move from India and refinance later if you need to.',
    replacesBlockedAccount: false,
    eligibility: 'In practice: a German address, a registered residence, a German bank account with salary going into it, and a Schufa record — so a year in, not on day one.',
    url: null,
    routes: ALL,
  },
];

export function fundingFor(route: string | null, opts: { needBlockedAccount?: boolean } = {}): FundingOption[] {
  const r = route ?? 'study';
  const list = FUNDING.filter((f) => f.routes.includes(r));
  // The things that remove the blocked account entirely come first when there is one to remove:
  // they change the size of the problem rather than paying for it.
  return list.sort((a, b) => {
    if (opts.needBlockedAccount) {
      const d = Number(b.replacesBlockedAccount) - Number(a.replacesBlockedAccount);
      if (d) return d;
    }
    return (b.coversEur ?? 0) - (a.coversEur ?? 0);
  });
}

/**
 * What a loan of this size actually costs each month.
 *
 * Standard amortisation. Shown because "9 to 11 percent" is not a number anybody can plan around,
 * and the monthly repayment is the figure that decides whether a family says yes.
 */
export function monthlyRepayment(principalEur: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (r === 0) return principalEur / n;
  return (principalEur * r) / (1 - Math.pow(1 + r, -n));
}
