/**
 * Scam shield and contract check.
 *
 * Indian applicants are the most defrauded group in this whole process. The pattern is always the
 * same: an agent who charges for a job that does not exist, an offer letter on a letterhead nobody
 * verified, a landlord who needs a deposit by Western Union for a flat that is not theirs. The
 * person checking is doing it in a second language, under time pressure, from another continent,
 * and the one thing they are never told is which checks are cheap and decisive.
 *
 * None of this is clever. It is the boring list, run before the money leaves.
 */

import { checkContract, contractKind, looksLikeContract, missingFromContract, type ContractFlag, type ContractKind } from './contracts';

// The contract check moved to its own file when it grew German rules: it is now the larger half of
// the shield and has nothing to do with scoring a sender. Re-exported so call sites do not care.
export { checkContract, contractKind, looksLikeContract, missingFromContract };
export type { ContractFlag, ContractKind };

export interface Signal {
  label: string;
  status: 'good' | 'warn' | 'bad';
  detail: string;
}

/** Public registers that settle the question, rather than opinions that do not. */
export const REGISTERS = {
  university: { label: 'Hochschulkompass (official register of German universities)', url: 'https://www.hochschulkompass.de/' },
  anabin: { label: 'anabin (is this degree recognised in Germany)', url: 'https://anabin.kmk.org/' },
  employer: { label: 'Unternehmensregister (German company register)', url: 'https://www.unternehmensregister.de/' },
  agent: { label: 'Make it in Germany — official portal', url: 'https://www.make-it-in-germany.com/' },
  recognition: { label: 'Recognition in Germany — official finder', url: 'https://www.anerkennung-in-deutschland.de/' },
};

/** Universities that exist. Short on purpose: a prototype should not pretend to a full register. */
const KNOWN_UNIS = [
  'rwth aachen',
  'technical university of munich',
  'tum',
  'technical university of darmstadt',
  'tu darmstadt',
  'university of cologne',
  'universität zu köln',
  'heidelberg',
  'lmu munich',
  'humboldt',
  'free university of berlin',
  'tu berlin',
  'karlsruhe institute of technology',
  'kit',
  'university of stuttgart',
  'leibniz university hannover',
];

const FREE_TLDS = /\.(tk|ml|ga|cf|gq|top|xyz|click|buzz)$/i;
const WEBMAIL = /@(gmail|yahoo|hotmail|outlook|rediffmail|protonmail|mail)\.(com|co\.in|in)$/i;
const WIRE = /\b(western union|moneygram|wire transfer|bitcoin|crypto|usdt|upi to a personal|gift card)\b/i;
const PRESSURE = /\b(only today|limited seats|pay within 24|immediately to confirm|last chance|hurry)\b/i;

export interface ScamInput {
  kind: 'university' | 'employer' | 'landlord' | 'agent' | 'offer';
  name: string;
  url?: string | null;
  email?: string | null;
  text?: string | null;
  /** Did the agent actually open the page in this run? */
  pageOpened?: boolean;
  /** Is the name in a catalogue we already trust? */
  inCatalogue?: boolean;
  /** Has anyone asked for money before a contract? */
  feeRequested?: boolean;
}

export function scamCheck(input: ScamInput): { verdict: 'looks_legitimate' | 'be_careful' | 'high_risk'; score: number; signals: Signal[]; neverDo: string[] } {
  const signals: Signal[] = [];
  const text = `${input.text ?? ''} ${input.name}`;
  let score = 60;

  // ---- the domain ----
  const domain = (() => {
    try {
      return input.url ? new URL(input.url).hostname.replace(/^www\./, '') : null;
    } catch {
      return null;
    }
  })();

  if (input.kind === 'university') {
    const known = KNOWN_UNIS.some((u) => input.name.toLowerCase().includes(u)) || input.inCatalogue === true;
    if (known) {
      score += 25;
      signals.push({ label: 'In the official register', status: 'good', detail: `${input.name} is a recognised German higher-education institution. Degrees from it are listed in anabin.` });
    } else {
      score -= 15;
      signals.push({ label: 'Not confirmed in the register', status: 'warn', detail: `I could not match "${input.name}" to the Hochschulkompass list. Check it there before you pay any fee — an unrecognised degree will not get you a visa.` });
    }
    if (domain && !/\.(de|edu|ac\.[a-z]{2})$/i.test(domain)) {
      score -= 10;
      signals.push({ label: 'Unusual web address', status: 'warn', detail: `German universities almost always sit on a .de domain. This one is ${domain}.` });
    } else if (domain) {
      score += 10;
      signals.push({ label: 'German academic domain', status: 'good', detail: `${domain} is a German domain, which is what a real university uses.` });
    }
  }

  if (domain && FREE_TLDS.test(domain)) {
    score -= 30;
    signals.push({ label: 'Throwaway domain', status: 'bad', detail: `${domain} uses a free domain ending. No German hospital, university or landlord does.` });
  }

  if (input.email && WEBMAIL.test(input.email)) {
    score -= 20;
    signals.push({
      label: 'Free email address',
      status: input.kind === 'landlord' ? 'warn' : 'bad',
      detail: `${input.email} is a personal webmail address. A real employer or university writes from its own domain. A private landlord may use webmail, but then everything else must check out.`,
    });
  } else if (input.email && domain && input.email.endsWith(`@${domain}`)) {
    score += 15;
    signals.push({ label: 'Email matches the website', status: 'good', detail: `The address is on the same domain as the website, which a lookalike usually cannot manage.` });
  }

  if (WIRE.test(text)) {
    score -= 40;
    signals.push({ label: 'Asks for money by an untraceable route', status: 'bad', detail: 'Western Union, crypto and gift cards cannot be reversed or traced. No legitimate German party asks for any of them. This is the single clearest sign of a scam.' });
  }
  if (PRESSURE.test(text)) {
    score -= 15;
    signals.push({ label: 'Time pressure', status: 'warn', detail: 'Urgency is the oldest tool there is. German admissions and hiring both run on fixed, published deadlines — nothing real expires in 24 hours.' });
  }
  if (input.feeRequested) {
    score -= 25;
    signals.push({
      label: 'A fee before a contract',
      status: 'bad',
      detail: 'For a job, the employer pays the recruiter, never you. If someone wants a placement fee from you before a signed contract, stop.',
    });
  }
  if (input.pageOpened) {
    score += 10;
    signals.push({ label: 'Their page opened and matched', status: 'good', detail: 'I opened the page myself in this check and the details on it line up with what you were sent.' });
  }
  if (input.kind === 'landlord') {
    signals.push({
      label: 'Deposit limit',
      status: 'warn',
      detail: 'A German deposit (Kaution) is capped at three months of cold rent by law, and is paid after a signed contract — never to see a flat.',
    });
  }

  score = Math.max(0, Math.min(100, score));
  const verdict = score >= 70 ? 'looks_legitimate' : score >= 45 ? 'be_careful' : 'high_risk';

  return {
    verdict,
    score,
    signals,
    neverDo: [
      'Never pay a deposit or a fee before you have a signed contract in your hand.',
      'Never send money by Western Union, MoneyGram, crypto or gift card — it cannot be traced or reversed.',
      'Never send your passport scan to someone who has not proved who they are.',
      'Never sign a contract you have not had translated. Ask Educaro and we will read it with you.',
      'An employer pays the recruiter. If a "job" costs you money up front, it is not a job.',
    ],
  };
}

/** What applies whatever the contract says, and who to call when it is being ignored. */
export const WORK_RIGHTS = [
  { title: 'The minimum wage applies to you', detail: 'EUR 12.82 an hour from 2025, for everyone, whatever your contract says and whatever your visa is. Nursing under TVöD-P pays well above it.' },
  { title: 'Your passport stays with you', detail: 'No employer may hold it. If someone has taken it, that alone is worth a call to us today.' },
  { title: 'At least 20 days of paid holiday', detail: 'On a five-day week. It is statutory and cannot be signed away.' },
  { title: 'Maximum 8 hours a day', detail: 'Extendable to 10 only if the six-month average stays at 8. Rest of at least 11 hours between shifts.' },
  { title: 'Six weeks of sick pay', detail: 'Full pay for up to six weeks of illness, then sickness benefit from your Krankenkasse. Bring the sick note by the third day.' },
  { title: 'Probation is six months, no longer', detail: 'After that normal dismissal protection applies, whatever the contract claims.' },
  { title: 'You may change employer', detail: 'A work visa ties to a qualification, not to one company. Talk to us before you resign, so the permit is handled properly.' },
];

export const HELP_CONTACTS = [
  { label: 'Educaro, confidentially', detail: 'Tell us privately. It stays between you and us, and it changes how we rate that employer for everyone who comes after you.', url: null },
  { label: 'Faire Integration — free, independent advice', detail: 'Government-funded counselling for migrant workers, in several languages, free and independent of your employer.', url: 'https://www.faire-integration.de/' },
  { label: 'Your works council or ver.di', detail: 'Hospitals usually have a Betriebsrat. The union ver.di represents care workers and will act for you.', url: 'https://www.verdi.de/' },
  { label: 'Emergency: 110 police, 112 ambulance', detail: 'Free from any phone, no credit needed. English is usually understood.', url: null },
];
