/**
 * The fair-contract check.
 *
 * An applicant is handed a contract in a language they do not read, by the person who decides
 * whether they get to come, and asked to sign it today. The asymmetry is the whole problem: they
 * have no way to tell a normal German employment contract from one that has been quietly loaded.
 *
 * What makes this tractable is that German law voids a lot of what gets put in front of them. A
 * clause can be printed, signed and stamped and still be worth nothing — "Überstunden sind mit dem
 * Gehalt abgegolten" is in thousands of real contracts and the Bundesarbeitsgericht has held the
 * blanket version invalid. So the useful thing to say is not "this looks unfair", it is "this
 * clause does not bind you, and here is the law that says so".
 *
 * Two deliberate choices:
 *
 * - **Every rule matches German and English.** The first version of this check was English-only,
 *   which meant it scored a real Arbeitsvertrag as clean. A contract check that passes every actual
 *   contract is worse than none, because it tells somebody it is safe to sign.
 * - **Nothing here says "consult a lawyer" and stops.** That is the advice people already have and
 *   cannot act on. Each rule carries the specific provision, so they can hold a sentence in their
 *   hand when they push back.
 *
 * Citations name the provision rather than a case summary. Where the position comes from case law
 * rather than statute, the rule says so.
 */

export type ContractKind = 'work' | 'rental' | 'unknown';

export interface ContractFlag {
  clause: string;
  /** What it means for them, in the words they would use themselves. */
  why: string;
  /** What German law actually says, with the provision named. */
  lawSays: string;
  severity: 'unfair' | 'illegal' | 'watch';
  /** The provision, so a consultant can go straight to it. */
  cite?: string;
  /** The sentence in their own contract that triggered this, so the finding is checkable. */
  quote?: string;
}

interface Rule {
  id: string;
  re: RegExp;
  flag: Omit<ContractFlag, 'quote'>;
  kind: ContractKind | 'any';
}

/* ------------------------------------------------------------------ employment */

const WORK_RULES: Rule[] = [
  {
    id: 'passport',
    kind: 'work',
    re: /\b(passport|reisepass)\b[^.;]{0,70}\b(retain|keep|hold|deposit|surrender|hinterleg\w*|einbehalt\w*|verwahr\w*|aufbewahr\w*)\b|\b(retain|keep|hold|hinterleg\w*|einbehalt\w*)\b[^.;]{0,50}\b(passport|reisepass)\b/i,
    flag: {
      clause: 'The employer keeps your passport',
      why: 'Your passport is yours. An employer holding it is the single most common way people are stopped from leaving a job that has gone wrong.',
      lawSays:
        'No German employer may hold your passport. It stays your property, you can demand it back at any moment, and refusing to return it can be unlawful coercion. If this clause is in your contract, treat the whole contract as suspect.',
      severity: 'illegal',
      cite: '§ 240 StGB; PassG § 1',
    },
  },
  {
    id: 'overtime-included',
    kind: 'work',
    re: /\b(overtime|überstunden|mehrarbeit)\b[^.;]{0,80}\b(abgegolten|abgedeckt|included|covered|unpaid|not paid|nicht vergütet|nicht gesondert verg)\w*|\b(alle|sämtliche|all)\b[^.;]{0,30}\b(überstunden|overtime)\b[^.;]{0,40}\b(abgegolten|included|covered)\b/i,
    flag: {
      clause: 'Overtime is "already covered by the salary"',
      why: 'This is the most common way a good-looking salary quietly becomes a bad hourly rate. Ten unpaid hours a week is a 25% pay cut.',
      lawSays:
        'A blanket clause covering unlimited overtime is invalid — the Bundesarbeitsgericht requires an employee to be able to tell, when signing, what they are agreeing to. Overtime must then be paid or given back as time off. A capped clause ("up to 10 hours a month") can be valid.',
      severity: 'unfair',
      cite: 'BAG 5 AZR 517/09; § 307 BGB (transparency)',
    },
  },
  {
    id: 'hours',
    kind: 'work',
    re: /\b(\d{2,3})\s*(hours?|stunden)\b[^.;]{0,40}\b(per|a|pro)\s*(week|woche)\b|\b(wochenarbeitszeit|weekly working time)\b[^.;]{0,30}(\d{2,3})\b/i,
    flag: {
      clause: 'Weekly hours at or above the legal maximum',
      why: 'Long weeks are how a decent monthly figure turns into a bad hourly one, and how people burn out in the first year.',
      lawSays:
        'The Arbeitszeitgesetz caps the working day at 8 hours. It may go to 10 only if the average over six months stays at 8 — about 48 hours a week as an absolute ceiling, and you are entitled to 11 hours of rest between shifts.',
      severity: 'illegal',
      cite: '§ 3, § 5 ArbZG',
    },
  },
  {
    id: 'probation',
    kind: 'work',
    re: /\b(probation\w*|probezeit)\b[^.;]{0,50}\b(7|8|9|10|11|12|seven|eight|nine|ten|eleven|twelve|sieben|acht|neun|zehn|elf|zwölf)\s*(months?|monate?n?)\b/i,
    flag: {
      clause: 'A probation period longer than six months',
      why: 'During probation you can be dismissed with two weeks notice. Stretching it keeps you dismissable for longer than the law allows.',
      lawSays:
        'Probezeit may not exceed six months. After six months of employment, ordinary dismissal protection applies whatever the contract says.',
      severity: 'illegal',
      cite: '§ 622(3) BGB; § 1 KSchG',
    },
  },
  {
    id: 'notice-asymmetry',
    kind: 'work',
    re: /\b(notice|kündigungsfrist|kündigung)\b[^.;]{0,70}\b(6|six|12|twelve|sechs|zwölf)\s*(months?|monate?n?)\b[^.;]{0,50}\b(employee|arbeitnehmer)\b|\b(notice|kündigungsfrist)\b[^.;]{0,50}\b(employee|arbeitnehmer)\b[^.;]{0,30}\b(6|six|12|twelve|sechs|zwölf)\s*(months?|monate?n?)\b|\b(arbeitnehmer|employee)\b[^.;]{0,50}\b(kündigungsfrist|notice)\b[^.;]{0,40}\b(6|12|sechs|zwölf)\s*(months?|monate?n?)\b/i,
    flag: {
      clause: 'A longer notice period for you than for them',
      why: 'An asymmetric notice period means you cannot leave but they can let you go. It is how someone stays in a job they have already decided to quit.',
      lawSays:
        'The notice period for the employee may never be longer than the one that applies to the employer. A clause that makes it longer is void, and the employer’s period applies to both.',
      severity: 'illegal',
      cite: '§ 622(6) BGB',
    },
  },
  {
    id: 'holiday',
    kind: 'work',
    re: /\b(holiday|vacation|urlaub|urlaubsanspruch)\b[^.;]{0,50}\b(0|[1-9]|1[0-9])\s*(days?|tage?n?|werktage?n?)\b|\b(no|kein\w*|ohne)\b[^.;]{0,30}\b(paid )?(holiday|urlaub|vacation)\b|\b(forfeits?|verfällt)\b[^.;]{0,30}\b(holiday|urlaub)\b/i,
    flag: {
      clause: 'Less paid holiday than the statutory minimum',
      why: 'Holiday is not something a German employer grants as a favour, and you will need it — most people fly home once a year on it.',
      lawSays:
        'The statutory minimum is 24 working days a year on a six-day week, which is 20 days on a five-day week. It cannot be contracted away. Nursing under TVöD-P is 30 days plus extra for shift work.',
      severity: 'illegal',
      cite: '§ 3 BUrlG',
    },
  },
  {
    id: 'repayment',
    kind: 'work',
    re: /\b(repay|reimburse|refund|pay back|rückzahl\w*|erstatt\w*|zurückzahl\w*)\b[^.;]{0,90}\b(training|fortbildung|weiterbildung|recruitment|relocation|visa|flight|flug|umzug|german course|sprachkurs|anerkennung|vermittlung)\b/i,
    flag: {
      clause: 'You repay training, recruitment, flight or visa costs if you leave',
      why: 'A repayment clause can make it impossible to leave a job that turns out to be bad — the debt is the lock on the door.',
      lawSays:
        'Repayment clauses bind only if the training genuinely helps you elsewhere, the sum is proportionate, and the tie-in is short, with the amount falling month by month. Courts routinely strike down clauses over 1–2 years, clauses with no sliding scale, and any clause that makes you repay when the employer caused you to leave. Recruitment and visa costs are the employer’s own and are generally not recoverable at all.',
      severity: 'unfair',
      cite: 'BAG 9 AZR 442/16; § 307 BGB',
    },
  },
  {
    id: 'penalty',
    kind: 'work',
    re: /\b(vertragsstrafe|contractual penalty|liquidated damages|pönale)\b/i,
    flag: {
      clause: 'A contractual penalty if you break the contract',
      why: 'A penalty clause is often written to frighten rather than to be enforced, and it works — people stay because of a number they were never going to be charged.',
      lawSays:
        'A penalty in a pre-written contract must be proportionate and precisely defined. One exceeding a month’s gross salary, or one triggered by vaguely described conduct, is generally void as an unreasonable disadvantage.',
      severity: 'unfair',
      cite: '§ 307, § 309 Nr. 6 BGB',
    },
  },
  {
    id: 'ausschlussfrist',
    kind: 'work',
    re: /\b(ausschlussfrist|verfallfrist|preclusion period|forfeiture period)\b[^.;]{0,90}\b([1-2])\s*(month|monat)|\b(verfallen|forfeit\w*|lapse)\b[^.;]{0,70}\b([1-2])\s*(month|monat)/i,
    flag: {
      clause: 'A very short deadline to claim unpaid wages',
      why: 'If you do not claim unpaid overtime within the window, the money is simply gone. One or two months is nothing when you are new, working shifts and still learning the language.',
      lawSays:
        'A preclusion period in a pre-written contract must be at least three months per stage, and it can never apply to the statutory minimum wage. Anything shorter is void.',
      severity: 'illegal',
      cite: 'BAG 5 AZR 52/14; § 3 MiLoG',
    },
  },
  {
    id: 'non-compete',
    kind: 'work',
    re: /\b(wettbewerbsverbot|non-?compete|konkurrenzklausel|restraint of trade)\b/i,
    flag: {
      clause: 'You may not work for a competitor after you leave',
      why: 'In nursing this can mean not working at another hospital in the same city — which, when you have just moved continents, means not working.',
      lawSays:
        'A post-contractual non-compete binds only if the employer pays you at least half your last earnings for every month it runs, in writing, for a maximum of two years. Without that compensation (Karenzentschädigung) the clause is void and you may ignore it.',
      severity: 'illegal',
      cite: '§§ 74, 74a HGB',
    },
  },
  {
    id: 'salary-secrecy',
    kind: 'work',
    re: /\b(gehalt|salary|vergütung)\b[^.;]{0,50}\b(geheim\w*|vertraulich|confidential|secret|not disclose|nicht offenlegen|verschwiegenheit)\b|\b(verschwiegenheit|confidentiality)\b[^.;]{0,40}\b(gehalt|salary|vergütung)\b/i,
    flag: {
      clause: 'You may not tell anyone what you are paid',
      why: 'Pay secrecy is how two nurses on the same ward doing the same work are paid differently for years without either finding out.',
      lawSays:
        'A clause forbidding you to discuss your own pay is void. Employees may talk about their salary, and the Entgelttransparenzgesetz gives you a right to ask what comparable colleagues earn in firms over 200 staff.',
      severity: 'illegal',
      cite: 'LAG Mecklenburg-Vorpommern 2 Sa 237/09; EntgTranspG',
    },
  },
  {
    id: 'side-job-ban',
    kind: 'work',
    re: /\b(nebentätigkeit|nebenbeschäftigung|secondary employment|second job)\b[^.;]{0,60}\b(untersagt|verboten|nicht gestattet|prohibited|not permitted|forbidden)\b/i,
    flag: {
      clause: 'A blanket ban on any other work',
      why: 'A total ban is wider than the employer’s actual interest, and it matters most in the first year when the money is tightest.',
      lawSays:
        'A blanket prohibition is void. The employer may only restrict secondary work that genuinely conflicts — a competitor, or hours that break the Arbeitszeitgesetz. Otherwise what you do in your own time is yours, protected by occupational freedom.',
      severity: 'unfair',
      cite: 'Art. 12 GG; § 307 BGB',
    },
  },
  {
    id: 'tied-housing',
    kind: 'work',
    re: /\b(accommodation|housing|unterkunft|wohnung|zimmer)\b[^.;]{0,70}\b(deduct\w*|withheld|abgezogen|einbehalt\w*|vom gehalt|from the salary|from the wages)\b/i,
    flag: {
      clause: 'Accommodation is deducted from your wages',
      why: 'Tied housing with an unclear rent is how pay disappears and how leaving the job also means losing the room. It is the pattern behind most serious cases we see.',
      lawSays:
        'A deduction must name a specific amount, must leave you above the attachment-free minimum (about EUR 1,500 a month in 2026), and may not exceed the local comparative rent. Tying the room to the job does not let the employer charge more than it is worth.',
      severity: 'watch',
      cite: '§ 107(2) GewO; § 850c ZPO',
    },
  },
  {
    id: 'below-minimum-wage',
    kind: 'work',
    re: /(?:eur|euro|€)\s?(?:[4-9]|1[0-2])(?:[.,]\d{1,2})?\s*(?:per|pro|\/)\s*(?:hour|stunde|h)\b/i,
    flag: {
      clause: 'An hourly rate below the German minimum wage',
      why: 'The minimum wage is not negotiable and does not depend on your visa, your language level or how grateful you are expected to be.',
      lawSays:
        'The statutory minimum is EUR 12.82 an hour (2025 rate, rising annually). It applies to everyone working in Germany, whatever the contract says and whatever your nationality. Agreements below it are void and the difference stays owed to you.',
      severity: 'illegal',
      cite: '§§ 1, 3 MiLoG',
    },
  },
  {
    id: 'unilateral-change',
    kind: 'work',
    re: /\b(employer|arbeitgeber)\b[^.;]{0,60}\b(may|can|kann|darf|behält sich vor|reserves the right)\b[^.;]{0,60}\b(change|amend|ändern|anpassen|widerrufen|revoke)\b[^.;]{0,50}\b(duties|location|salary|gehalt|tätigkeit|einsatzort|arbeitsort|vergütung)\b/i,
    flag: {
      clause: 'The employer can change your job, pay or location at will',
      why: 'A free hand to move you to another city or another ward turns a signed contract into an intention.',
      lawSays:
        'A reservation of the right to change terms is valid only within narrow limits — it must be transparent and must not touch the core of the bargain. A clause letting the employer cut pay or move you anywhere is void.',
      severity: 'unfair',
      cite: '§ 308 Nr. 4, § 307 BGB',
    },
  },
];

/* ------------------------------------------------------------------ rental */

const RENTAL_RULES: Rule[] = [
  {
    id: 'deposit-cap',
    kind: 'rental',
    re: /\b(kaution|deposit|sicherheitsleistung)\b[^.;]{0,70}\b(4|5|6|four|five|six|vier|fünf|sechs)\s*(months?|monate?n?|monatsmieten?|kaltmieten?)\b/i,
    flag: {
      clause: 'A deposit above three months rent',
      why: 'The deposit is usually the largest single sum you send before you have seen anything, and it is the one most often asked for in excess.',
      lawSays:
        'A rental deposit is capped at three months of cold rent (Kaltmiete, excluding bills), and you are entitled to pay it in three monthly instalments. Anything above that is simply not owed.',
      severity: 'illegal',
      cite: '§ 551 BGB',
    },
  },
  {
    id: 'renovation',
    kind: 'rental',
    re: /\b(schönheitsreparaturen|renovation|renovieren|cosmetic repairs)\b[^.;]{0,90}\b(alle|every|spätestens|at the latest|jedes|starre|fixed)\b[^.;]{0,40}\d\s*(jahre?n?|years?)\b/i,
    flag: {
      clause: 'You must redecorate on a fixed schedule',
      why: 'Rigid deadlines mean painting a flat you have barely lived in, or paying someone to.',
      lawSays:
        'Rigid renovation deadlines are void — the Bundesgerichtshof requires the actual condition of the flat to decide. A clause with fixed years invalidates the whole renovation obligation, so you owe nothing. You also cannot be made to renovate a flat you received unrenovated.',
      severity: 'illegal',
      cite: 'BGH VIII ZR 185/14; § 307 BGB',
    },
  },
  {
    id: 'pets',
    kind: 'rental',
    re: /\b(tierhaltung|pets?|haustiere?)\b[^.;]{0,50}(generell|grundsätzlich|strictly)?\s*(verboten|untersagt|not allowed|not permitted|prohibited)\b/i,
    flag: {
      clause: 'A blanket ban on pets',
      why: 'Not the biggest issue on the list, but a landlord who writes void clauses has usually written more than one.',
      lawSays:
        'A general ban on all pets is void. The landlord must weigh each case; small caged animals need no permission at all.',
      severity: 'unfair',
      cite: 'BGH VIII ZR 168/12',
    },
  },
  {
    id: 'no-sublet',
    kind: 'rental',
    re: /\b(untervermietung|subletting|sublet)\b[^.;]{0,50}\b(verboten|untersagt|ausgeschlossen|prohibited|not permitted)\b/i,
    flag: {
      clause: 'You may never sublet, in any circumstances',
      why: 'If you go home for two months, or move in with a partner, a total ban means paying for an empty room.',
      lawSays:
        'You have a statutory right to ask to sublet part of the flat where you have a legitimate interest, and the landlord may only refuse for good reason. A blanket exclusion does not remove that right.',
      severity: 'unfair',
      cite: '§ 553 BGB',
    },
  },
  {
    id: 'long-lock-in',
    kind: 'rental',
    re: /\b(kündigungsverzicht|kündigungsausschluss|minimum term|mindestlaufzeit)\b[^.;]{0,60}\b([5-9]|[1-9]\d)\s*(years?|jahre?n?)\b/i,
    flag: {
      clause: 'You cannot give notice for several years',
      why: 'A long lock-in on a flat you have never seen, in a city you have never lived in, is a serious commitment to make from abroad.',
      lawSays:
        'A waiver of the right to terminate may not exceed four years from signing. Beyond that it is void and the normal three-month notice applies.',
      severity: 'illegal',
      cite: '§ 557a(3) BGB; BGH VIII ZR 27/04',
    },
  },
  {
    id: 'no-viewing',
    kind: 'rental',
    re: /\b(besichtigung|viewing)\b[^.;]{0,40}\b(nicht möglich|not possible|only after|nur nach|after payment|nach zahlung|erst nach)\b|\b(without|ohne)\s+(a\s+)?(viewing|besichtigung)\b/i,
    flag: {
      clause: 'No viewing before you pay',
      why: 'This is the single most common shape of the rental scam aimed at people arriving from abroad: a real listing, real photos, a flat the "landlord" has never owned.',
      lawSays:
        'Nothing obliges you to pay before seeing a flat, and no legitimate German landlord asks. Have someone view it for you, or ask Educaro for a contact in that city. A deposit is due after a signed contract and never before.',
      severity: 'illegal',
      cite: '§ 551 BGB',
    },
  },
];

/**
 * German survives this journey in three spellings and all of them land in this function.
 *
 * A contract typed in Germany has "Kündigungsfrist". The same contract scanned and OCR'd often has
 * "Kuendigungsfrist", because the transliteration is what the typist or the scanner produced, and a
 * contract retyped by an agent abroad has "Kundigungsfrist". Writing every rule three ways would be
 * unreadable and would rot, so each pattern is written once with real umlauts and widened here.
 *
 * Widening the pattern rather than folding the text is deliberate: it means the quote we show back
 * is the applicant's own sentence, character for character, instead of a mangled copy of it. A
 * person checking our finding against their paper has to find the words we claim are there.
 */
const UMLAUT: Record<string, string> = {
  'ä': '(?:ä|ae|a)',
  'ö': '(?:ö|oe|o)',
  'ü': '(?:ü|ue|u)',
  'ß': '(?:ß|ss)',
};

const tolerant = (re: RegExp): RegExp => new RegExp(re.source.replace(/[äöüß]/g, (c) => UMLAUT[c]), re.flags);

const ALL_RULES: Rule[] = [...WORK_RULES, ...RENTAL_RULES].map((r) => ({ ...r, re: tolerant(r.re) }));

/* ------------------------------------------------------------------ detection */

const WORK_HINTS = /\b(arbeitsvertrag|employment contract|anstellungsvertrag|arbeitnehmer|arbeitgeber|employer|employee|gehalt|salary|probezeit|dienstvertrag|tvöd)\b/gi;
const RENTAL_HINTS = /\b(mietvertrag|rental agreement|tenancy|vermieter|mieter|landlord|tenant|kaltmiete|warmmiete|kaution|lease)\b/gi;

const WORK_RE = tolerant(WORK_HINTS);
const RENTAL_RE = tolerant(RENTAL_HINTS);

/** Which kind of contract this is, so rental rules do not fire on a job offer and vice versa. */
export function contractKind(text: string): ContractKind {
  const work = (text.match(WORK_RE) ?? []).length;
  const rental = (text.match(RENTAL_RE) ?? []).length;
  if (!work && !rental) return 'unknown';
  return rental > work ? 'rental' : 'work';
}

/**
 * Does this text look like a contract at all, rather than a CV or a diploma?
 *
 * Used to decide whether to read a file the applicant uploaded. Matching on the *filename* was the
 * old rule, and it meant a contract scanned as `IMG_0423.pdf` was never checked — which is most of
 * them, because people photograph the paper they were handed.
 */
export function looksLikeContract(text: string): boolean {
  const t = text ?? '';
  if (t.length < 400) return false;
  // No `` before `§`: a space followed by `§` is non-word to non-word, so the boundary never
  // matches and this returned false on every real German contract it was given.
  const structure = tolerant(/(§\s*\d|klausel|clause|vereinbar\w*|vertrag|schließen folgenden|terms and conditions|hereby agrees)/i);
  return [WORK_RE, RENTAL_RE, structure].filter((re) => new RegExp(re.source, re.flags.replace('g', '')).test(t)).length >= 2;
}

/**
 * The hours rule needs the number, not just the shape: "40 hours per week" is a normal contract and
 * flagging it would make the whole check noise. Only 48 and above is actually over the ceiling.
 */
function hoursAreLegal(quote: string): boolean {
  const n = Number((quote.match(/(\d{2,3})\s*(hours?|stunden)/i) ?? [])[1]);
  return !Number.isFinite(n) || n < 48;
}

/** The sentence a rule matched, trimmed to something a person can find again in their own contract. */
function sentenceAround(text: string, re: RegExp): string | undefined {
  const m = new RegExp(re.source, re.flags.replace('g', '')).exec(text);
  if (!m) return undefined;
  const start = Math.max(0, text.lastIndexOf('.', m.index) + 1);
  const dot = text.indexOf('.', m.index + m[0].length);
  const end = dot === -1 ? Math.min(text.length, m.index + m[0].length + 120) : dot + 1;
  return text.slice(start, end).trim().slice(0, 260);
}

/**
 * Reads a contract and returns what will not hold.
 *
 * Ordered by severity, because somebody deciding today reads the first two things on a screen.
 */
export function checkContract(text: string, kindHint?: ContractKind): ContractFlag[] {
  const t = (text ?? '').replace(/\s+/g, ' ');
  if (!t) return [];
  const kind = kindHint && kindHint !== 'unknown' ? kindHint : contractKind(t);

  const found: ContractFlag[] = [];
  for (const rule of ALL_RULES) {
    if (rule.kind !== 'any' && kind !== 'unknown' && rule.kind !== kind) continue;
    if (!rule.re.test(t)) continue;
    const quote = sentenceAround(t, rule.re);
    if (rule.id === 'hours' && quote && hoursAreLegal(quote)) continue;
    found.push({ ...rule.flag, quote });
  }

  const weight = { illegal: 0, unfair: 1, watch: 2 } as const;
  return found.sort((a, b) => weight[a.severity] - weight[b.severity]);
}

/**
 * What a fair contract contains, so the check can say what is *missing* rather than only what is
 * wrong. A contract with no clause about hours at all is its own warning.
 */
// German builds compounds, so a trailing `\b` is the enemy here: "Urlaubsanspruch" does not match
// `\burlaub\b`, and the check then reported holiday as absent from a contract that grants it. Every
// German stem below is left open for that reason; the English ones stay closed, because "start"
// should not be satisfied by "started".
const MUST_HAVE: { id: string; label: string; re: RegExp; kind: ContractKind }[] = [
  { id: 'pay', label: 'A stated salary or hourly rate', re: /\b(eur|euro|€|gehalt\w*|salary\b|vergütung\w*|lohn\w*)/i, kind: 'work' },
  { id: 'hours', label: 'The weekly working hours', re: /\b(hours?\b|stunden\w*|arbeitszeit\w*)/i, kind: 'work' },
  { id: 'holiday', label: 'Your holiday entitlement', re: /\b(urlaub\w*|holidays?\b|vacation\b)/i, kind: 'work' },
  { id: 'notice', label: 'The notice period on both sides', re: /\b(kündigung\w*|notice period\b)/i, kind: 'work' },
  { id: 'start', label: 'The start date', re: /\b(beginn\w*|eintritt\w*|starts?\b|commenc\w+)/i, kind: 'work' },
  { id: 'role', label: 'What your job actually is', re: /\b(tätigkeit\w*|aufgabe\w*|stelle\w*|position\b|role\b|duties\b)/i, kind: 'work' },
  { id: 'rent', label: 'The cold rent, stated separately from bills', re: /\b(kaltmiete\w*|grundmiete\w*|cold rent\b|net rent\b)/i, kind: 'rental' },
  { id: 'deposit', label: 'The deposit amount', re: /\b(kaution\w*|sicherheitsleistung\w*|deposit\b)/i, kind: 'rental' },
  { id: 'nebenkosten', label: 'What the service charges cover', re: /\b(nebenkosten\w*|betriebskosten\w*|service charges\b|utilities\b)/i, kind: 'rental' },
  { id: 'wgb', label: 'A Wohnungsgeberbestätigung — you cannot register without it', re: /\b(wohnungsgeberbest\w*|wohnungsgeberbesch\w*|landlord confirmation\b)/i, kind: 'rental' },
];

export function missingFromContract(text: string, kind: ContractKind): { id: string; label: string }[] {
  const t = (text ?? '').replace(/\s+/g, ' ');
  if (!t || kind === 'unknown') return [];
  return MUST_HAVE.filter((m) => m.kind === kind && !tolerant(m.re).test(t)).map(({ id, label }) => ({ id, label }));
}
