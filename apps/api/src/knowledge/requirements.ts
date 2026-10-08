/**
 * Reading admission and hiring requirements off a page, and noticing when they move.
 *
 * A jury asked the right question about this product: what is a document actually checked against?
 * The answer has to be a written rule somewhere, and for admissions that rule lives on a university
 * page that changes without telling anybody. RWTH quietly drops its IELTS band from 6.5 to 6.0 and
 * roughly four hundred people who were told "not yet" are now eligible — and every one of them
 * finds out months later, if at all, because nobody re-reads a page they have already been rejected
 * against.
 *
 * So: parse the page into a small set of comparable requirements, store it, and compare the next
 * read against the last. Everything here is code rather than a model, for three reasons. A number
 * that decides whether somebody is told they qualify must not be hallucinated. The comparison has
 * to be stable, or every poll invents a change and the notification becomes noise people mute. And
 * it must run with no keys at all.
 *
 * What is deliberately *not* here: prose. A requirement is only modelled when it is a scalar we can
 * order — a band, a level, a grade, a count, a date. "Relevant professional experience is desirable"
 * is real and matters and cannot be diffed, so it is left to the human reading the page.
 */

export type ReqKey =
  | 'ielts'
  | 'toefl'
  | 'german'
  | 'english'
  | 'grade'
  | 'ects'
  | 'math_ects'
  | 'aps'
  | 'gre'
  | 'deadline'
  | 'semester_fee'
  | 'experience_years'
  | 'recognition'
  | 'salary';

export interface Requirement {
  key: ReqKey;
  /** Comparable value. CEFR becomes 1–6, booleans become 0/1, dates become a day number. */
  value: number;
  /** What the page actually said, so a change can be shown in the page's own words. */
  raw: string;
  /** For a human: "IELTS overall band". */
  label: string;
}

/** Lower is better for these: a German grade of 2.5 is easier to meet than 2.0. */
const LOWER_IS_EASIER = new Set<ReqKey>(['grade']);
/** These are not thresholds at all; a later deadline or a higher salary is better for the applicant. */
const HIGHER_IS_BETTER = new Set<ReqKey>(['deadline', 'salary']);

const CEFR = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
export const cefrValue = (s: string): number => CEFR.indexOf(s.toLowerCase()) + 1;
export const cefrLabel = (n: number): string => (CEFR[n - 1] ?? '').toUpperCase();

const LABELS: Record<ReqKey, string> = {
  ielts: 'IELTS overall band',
  toefl: 'TOEFL iBT score',
  german: 'German level',
  english: 'English level',
  grade: 'Final grade (German scale)',
  ects: 'ECTS credits',
  math_ects: 'ECTS credits in mathematics',
  aps: 'APS certificate',
  gre: 'GRE',
  deadline: 'Application deadline',
  semester_fee: 'Semester contribution',
  experience_years: 'Years of experience',
  recognition: 'Recognition (Anerkennung)',
  salary: 'Salary',
};

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/**
 * Is this sentence saying the thing is *not* needed?
 *
 * The first version looked for any negative word anywhere in the snippet, which read "Recognition
 * of your qualification must be in progress; it does not need to be complete" as "recognition not
 * required" — the exact opposite, on a page where getting it wrong tells a nurse she can skip the
 * one step that takes four months. The negative has to attach to the requirement itself.
 */
function saysNotRequired(snippet: string): boolean {
  return /\b(?:not|no longer|never)\s+(?:a\s+)?(?:required|requirement|necessary|mandatory)\b|\bno\s+\w{0,12}\s*(?:is\s+)?required\b|\bexempt\b|\bwithout\s+(?:an?\s+)?(?:APS|GRE|recognition|Anerkennung)\b/i.test(snippet);
}

/** A day-of-year number, so "1 March" and "15 January" are comparable without a year. */
function dayOfYear(day: number, monthIndex: number): number {
  const cum = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return cum[monthIndex] + day;
}

interface Rule {
  key: ReqKey;
  re: RegExp;
  /** Pull the comparable number out of the match. */
  read: (m: RegExpMatchArray) => number | null;
}

const RULES: Rule[] = [
  {
    key: 'ielts',
    re: /\bIELTS\b[^.\n]{0,70}?(\d(?:\.\d)?)\b/i,
    read: (m) => Number(m[1]),
  },
  {
    key: 'toefl',
    re: /\bTOEFL\b[^.\n]{0,70}?(\d{2,3})\b/i,
    read: (m) => Number(m[1]),
  },
  {
    key: 'german',
    re: /\b(?:German|Deutsch)\b[^.\n]{0,90}?\b(A1|A2|B1|B2|C1|C2)\b|\b(A1|A2|B1|B2|C1|C2)\b[^.\n]{0,40}\b(?:German|Deutsch)\b/i,
    read: (m) => cefrValue(m[1] ?? m[2] ?? ''),
  },
  {
    key: 'english',
    re: /\bEnglish\b[^.\n]{0,90}?\b(A1|A2|B1|B2|C1|C2)\b/i,
    read: (m) => cefrValue(m[1] ?? ''),
  },
  {
    // "a final grade of at least 2.5 on the German grading scale"
    key: 'grade',
    re: /\b(?:final )?grade\b[^.\n]{0,60}?(\d(?:[.,]\d)?)\b[^.\n]{0,40}\bGerman\b|\bGerman grading scale\b[^.\n]{0,40}?(\d(?:[.,]\d)?)\b/i,
    read: (m) => Number((m[1] ?? m[2] ?? '').replace(',', '.')),
  },
  {
    key: 'math_ects',
    re: /\b(\d{1,3})\s*ECTS\b[^.\n]{0,50}\b(?:mathematic|maths?)\w*/i,
    read: (m) => Number(m[1]),
  },
  {
    key: 'ects',
    re: /\b(?:at least\s*)?(\d{2,3})\s*ECTS\b/i,
    read: (m) => Number(m[1]),
  },
  {
    key: 'aps',
    re: /\bAPS\b[^.\n]{0,80}/i,
    // "no APS is required" is a real sentence on a real page and inverts the meaning entirely.
    read: (m) => (saysNotRequired(m[0]) ? 0 : 1),
  },
  {
    key: 'gre',
    re: /\bGRE\b[^.\n]{0,80}/i,
    read: (m) => (saysNotRequired(m[0]) ? 0 : 1),
  },
  {
    key: 'recognition',
    re: /\b(?:Anerkennung|recognition of (?:your |the )?qualification|recognised qualification)\b[^.\n]{0,80}/i,
    read: (m) => (saysNotRequired(m[0]) ? 0 : 1),
  },
  {
    key: 'deadline',
    re: /\bdeadline\b[^.\n]{0,70}?\b(\d{1,2})\s+([A-Z][a-z]+)\b|\b(\d{1,2})\s+([A-Z][a-z]+)\b[^.\n]{0,30}\bdeadline\b/i,
    read: (m) => {
      const day = Number(m[1] ?? m[3]);
      const month = MONTHS.indexOf(String(m[2] ?? m[4] ?? '').toLowerCase());
      return month < 0 || !day ? null : dayOfYear(day, month);
    },
  },
  {
    key: 'semester_fee',
    re: /\bsemester (?:contribution|fee)\b[^.\n]{0,60}?EUR\s*(\d{2,4})\b|EUR\s*(\d{2,4})\b[^.\n]{0,40}\bper semester\b/i,
    read: (m) => Number(m[1] ?? m[2]),
  },
  {
    key: 'experience_years',
    re: /\b(?:at least\s*)?(\d{1,2})\s*(?:\+\s*)?years?\b[^.\n]{0,40}\b(?:experience|Berufserfahrung)\b/i,
    read: (m) => Number(m[1]),
  },
  {
    key: 'salary',
    re: /\bEUR\s*([\d.,]{3,8})\b[^.\n]{0,40}\b(?:per month|monthly|brutto|gross)\b/i,
    read: (m) => Number(String(m[1]).replace(/[.,]/g, '')),
  },
];

/**
 * Everything comparable this page states.
 *
 * Run over the visible text, not the HTML: a class name containing "b2" is not a language
 * requirement, and the first version of this read one.
 */
export function parseRequirements(text: string): Requirement[] {
  const t = (text ?? '').replace(/\r/g, '');
  const out: Requirement[] = [];
  for (const rule of RULES) {
    const m = t.match(rule.re);
    if (!m) continue;
    const value = rule.read(m);
    if (value === null || !Number.isFinite(value)) continue;
    out.push({ key: rule.key, value, raw: m[0].trim().replace(/\s+/g, ' ').slice(0, 180), label: LABELS[rule.key] });
  }
  return out;
}

export type ChangeDirection = 'easier' | 'harder' | 'added' | 'removed' | 'changed';

export interface RequirementChange {
  key: ReqKey;
  label: string;
  direction: ChangeDirection;
  before: number | null;
  after: number | null;
  beforeText: string | null;
  afterText: string | null;
  /** One sentence, in the words a person would use. */
  summary: string;
}

/** How a value should be shown: a CEFR level is not the number 4. */
export function showValue(key: ReqKey, value: number): string {
  if (key === 'german' || key === 'english') return cefrLabel(value);
  if (key === 'aps' || key === 'gre' || key === 'recognition') return value ? 'required' : 'not required';
  if (key === 'deadline') {
    const cum = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let mi = 11;
    while (mi > 0 && cum[mi] >= value) mi -= 1;
    const d = value - cum[mi];
    return `${d} ${MONTHS[mi][0].toUpperCase()}${MONTHS[mi].slice(1)}`;
  }
  if (key === 'semester_fee' || key === 'salary') return `EUR ${value.toLocaleString('en-GB')}`;
  // Bands are quoted to one decimal everywhere a candidate meets them, so "6.5 → 6" reads as a
  // typo rather than as a drop of half a band.
  if (key === 'ielts') return value.toFixed(1);
  return String(value);
}

/**
 * What moved between two readings of the same page.
 *
 * Direction is from the applicant's point of view, which is the only one that matters here: an
 * IELTS band dropping from 6.5 to 6.0 is *easier*, a grade requirement dropping from 2.5 to 2.0 is
 * *harder*, and the two look identical as numbers. Getting this backwards would tell four hundred
 * people they now qualify when they have just been excluded, so the direction is a table, not a
 * comparison.
 */
export function diffRequirements(before: Requirement[], after: Requirement[]): RequirementChange[] {
  const b = new Map(before.map((r) => [r.key, r]));
  const a = new Map(after.map((r) => [r.key, r]));
  const changes: RequirementChange[] = [];

  for (const [key, next] of a) {
    const prev = b.get(key);
    if (!prev) {
      changes.push({
        key,
        label: next.label,
        direction: 'added',
        before: null,
        after: next.value,
        beforeText: null,
        afterText: next.raw,
        summary: `${next.label} is now stated: ${showValue(key, next.value)}.`,
      });
      continue;
    }
    if (prev.value === next.value) continue;

    const rose = next.value > prev.value;
    const easier = HIGHER_IS_BETTER.has(key) ? rose : LOWER_IS_EASIER.has(key) ? rose : !rose;
    changes.push({
      key,
      label: next.label,
      direction: easier ? 'easier' : 'harder',
      before: prev.value,
      after: next.value,
      beforeText: prev.raw,
      afterText: next.raw,
      summary: `${next.label} ${easier ? 'eased' : 'tightened'}: ${showValue(key, prev.value)} → ${showValue(key, next.value)}.`,
    });
  }

  for (const [key, prev] of b) {
    if (a.has(key)) continue;
    changes.push({
      key,
      label: prev.label,
      direction: 'removed',
      before: prev.value,
      after: null,
      beforeText: prev.raw,
      afterText: null,
      summary: `${prev.label} is no longer mentioned on the page (was ${showValue(key, prev.value)}). Worth a human read before anyone relies on it.`,
    });
  }

  // Eased first: that is the one somebody is waiting to hear.
  const order: Record<ChangeDirection, number> = { easier: 0, removed: 1, harder: 2, added: 3, changed: 4 };
  return changes.sort((x, y) => order[x.direction] - order[y.direction]);
}

export interface ApplicantLevels {
  ielts?: number | null;
  toefl?: number | null;
  german?: number | null;
  english?: number | null;
  grade?: number | null;
  experienceYears?: number | null;
  hasAps?: boolean;
  hasRecognition?: boolean;
}

export interface Eligibility {
  eligible: boolean;
  /** Requirements they do not meet, each as a sentence. */
  blocking: { key: ReqKey; need: string; have: string }[];
}

/**
 * Does this person meet these requirements?
 *
 * Unknown is not the same as failing. Somebody who has never told us their IELTS band is not
 * ineligible, they are unmeasured, and treating the two the same would send "you now qualify" to
 * people we know nothing about. Only a value we actually hold can block.
 */
export function meets(reqs: Requirement[], who: ApplicantLevels): Eligibility {
  const blocking: Eligibility['blocking'] = [];

  for (const r of reqs) {
    const have = (() => {
      switch (r.key) {
        case 'ielts':
          return who.ielts ?? null;
        case 'toefl':
          return who.toefl ?? null;
        case 'german':
          return who.german ?? null;
        case 'english':
          return who.english ?? null;
        case 'grade':
          return who.grade ?? null;
        case 'experience_years':
          return who.experienceYears ?? null;
        case 'aps':
          return who.hasAps === undefined ? null : who.hasAps ? 1 : 0;
        case 'recognition':
          return who.hasRecognition === undefined ? null : who.hasRecognition ? 1 : 0;
        default:
          return null; // deadlines, fees and GRE are not things a person "meets".
      }
    })();
    if (have === null) continue;

    const ok = LOWER_IS_EASIER.has(r.key) ? have <= r.value : have >= r.value;
    if (!ok) blocking.push({ key: r.key, need: showValue(r.key, r.value), have: showValue(r.key, have) });
  }

  return { eligible: blocking.length === 0, blocking };
}
