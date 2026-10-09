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

/**
 * Money asked for before anything is signed — the actual scam pattern.
 *
 * A "security deposit" used to be on this list, which flagged every lawful rental: a Kaution is
 * required by law (§551 BGB), and the app's own advice says so two lines later. A check that
 * contradicts its own guidance teaches people to ignore it, and once it fires on ordinary offers
 * the one that matters reads the same as the six that did not.
 *
 * So the deposit counts only when it is being collected *before* a contract or a viewing, which is
 * the thing that is actually wrong. The clearly one-sided fees stay unconditional: no legitimate
 * German employer charges a candidate a placement fee, in any order.
 */
const FEE_ALWAYS = /\b(registration fee|processing fee|placement fee|recruitment fee|agency fee|visa processing charge)\b/i;
/** A deposit is lawful; a deposit demanded before a signature or a viewing is not. */
const DEPOSIT_BEFORE =
  /\b(deposit|kaution|advance payment|booking amount)\b[^.!?]{0,120}\b(before|prior to|in advance of|to (?:confirm|reserve|block|hold)|to secure)\b|\b(before|prior to|in advance of)\b[^.!?]{0,80}\b(deposit|kaution)\b|\b(deposit|kaution)\b[^.!?]{0,120}\bto (?:see|view|visit)\b/i;

/** Did someone ask for money in a way no legitimate German party would? */
export function feeBeforeContract(text: string): boolean {
  const t = text ?? '';
  return FEE_ALWAYS.test(t) || DEPOSIT_BEFORE.test(t);
}

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

  // Starts where an ordinary message sits, not below it.
  //
  // The baseline was 60 against a 70 threshold, so anything had to *earn* ten points before it
  // could be called legitimate — and the only ways to earn them are a page we could open or a
  // domain we recognise. A real offer pasted as plain text has neither, so it came back "be
  // careful" for no finding at all. That is absence of evidence being reported as evidence, and it
  // is how a check ends up flagging everything: once the ordinary case is a warning, the warning
  // stops carrying information.
  //
  // 75 is a message with nothing wrong with it. Everything below subtracts for something actually
  // found, and the good signals still lift a well-evidenced sender clear of the ordinary one.
  let score = 75;

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
      // Not a finding. Our list is sixteen names and Germany has over four hundred recognised
      // institutions, so "I have not heard of it" says more about the list than the university.
      // It is worth telling someone where to confirm it; it is not worth a score penalty, which is
      // what turned every real but less famous public university into "be careful".
      signals.push({
        label: 'Not on my shortlist — check the register',
        status: 'warn',
        detail: `I only hold the best-known German institutions, and "${input.name}" is not one of them — that does not make it fake. Confirm it on Hochschulkompass before you pay any fee, because an unrecognised degree will not get you a visa.`,
      });
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
    // A private landlord on WG-Gesucht really does write from Gmail — that is the normal case, not
    // the suspicious one, and the detail text said so while the score punished it anyway. The
    // penalty now matches the sentence: a note for a landlord, a real finding for an institution
    // that should own a domain.
    const landlord = input.kind === 'landlord';
    score -= landlord ? 5 : 20;
    signals.push({
      label: landlord ? 'Writes from a personal address' : 'Free email address',
      status: landlord ? 'warn' : 'bad',
      detail: landlord
        ? `${input.email} is personal webmail, which is normal for a private landlord — most of them are not companies. It only matters if something else is off, so judge it on the rest of this list.`
        : `${input.email} is a personal webmail address. A real employer or university writes from its own domain.`,
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
    // Worth more than it was. This used to fire on any mention of a "security deposit", including
    // the lawful one every tenant pays, so it had to be weighted gently or it would have condemned
    // every rental. Now that it only matches money demanded *before* a contract or a viewing, it
    // is one of the two or three things that genuinely settles the question, and it should be able
    // to carry a verdict on its own.
    score -= 40;
    signals.push({
      label: 'A fee before a contract',
      status: 'bad',
      detail: 'Money is being asked for before anything is signed. For a job, the employer pays the recruiter, never you; for a flat, the deposit comes after a signed contract and never to see the place.',
    });
  }
  if (input.pageOpened) {
    score += 10;
    signals.push({ label: 'Their page opened and matched', status: 'good', detail: 'I opened the page myself in this check and the details on it line up with what you were sent.' });
  }
  if (input.kind === 'landlord') {
    // This is advice every renter should have, not something found in *this* message. It was a
    // `warn`, so every lawful flat came back with a flag against it and the list stopped meaning
    // anything. Neutral unless the message actually asks for money up front, which the fee check
    // above has already decided.
    signals.push({
      label: 'Deposit limit',
      status: input.feeRequested ? 'warn' : 'good',
      detail: input.feeRequested
        ? 'A German deposit (Kaution) is capped at three months of cold rent by law, and is paid after a signed contract — never to see a flat. This message asks for money before that point.'
        : 'Worth knowing: a German deposit (Kaution) is capped at three months of cold rent by law, and is paid after signing — never to see a flat. Nothing here breaks that.',
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
