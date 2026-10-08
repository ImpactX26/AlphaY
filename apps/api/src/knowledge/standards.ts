import type { DocKind } from '@educaro/shared';

/**
 * What a document is checked against.
 *
 * A judge asked the question this file exists to answer: when an applicant uploads a certificate,
 * what decides whether it counts? Until now the honest answer was "a model read it and we believed
 * the fields", which is not a standard — it is a summary. A consulate does not reject a paper
 * because a model was unsure; it rejects it because the paper is six months stale, or the name on
 * it does not match the passport, or the issuer is not one it recognises.
 *
 * So the rules are written down, per document kind, and every upload is evaluated against them in
 * code. Three consequences worth the trouble:
 *
 * - **An applicant is told why, not that.** "Not accepted" helps nobody; "the issuer is not one of
 *   the four German authorities accept, and here they are" is something a person can act on.
 * - **Staff can change the bar without a deploy.** The standards live in the database and are
 *   edited in the admin panel, because they change when an authority changes its mind.
 * - **It is checkable.** Each failure names the rule and the value that broke it, so a consultant
 *   can disagree with the rule rather than with the verdict.
 *
 * Nothing here is a model call. A rule that decides whether somebody's paperwork is accepted has to
 * give the same answer twice.
 */

export type RuleKind =
  | 'required_field' // the field has to be present at all
  | 'not_expired' // a validity date that has not passed
  | 'max_age_months' // issued recently enough to still be accepted
  | 'min_level' // CEFR at or above a level
  | 'min_score' // a numeric score at or above a threshold
  | 'issuer_allowed' // from one of the bodies that are actually recognised
  | 'name_matches_passport' // the same person as the identity document
  | 'has_signature_or_stamp' // an unsigned certificate is a draft
  | 'min_legible_length'; // a scan that produced no text is a photograph of a problem

export interface StandardRule {
  kind: RuleKind;
  /** Which extracted field this rule reads, where it reads one. */
  field?: string;
  /** Threshold: months, a CEFR level, a score, or the list of accepted issuers. */
  value?: string | number;
  options?: string[];
  /** A failure that blocks, versus one worth telling somebody about. */
  severity: 'blocking' | 'warning';
  /** Why this rule exists, in the words we would use to the applicant. */
  because: string;
}

export interface DocStandard {
  docKind: DocKind;
  label: string;
  /** Where the rule comes from, so a consultant can argue with the source and not with us. */
  authority: string;
  rules: StandardRule[];
}

const CEFR = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
const cefr = (s: string) => CEFR.indexOf(String(s ?? '').toLowerCase().trim()) + 1;

/**
 * The default standards.
 *
 * Drawn from what the authorities actually ask for: the Anerkennung offices on language and
 * registration, the consulates on document age and translation, and uni-assist on transcripts.
 * They are defaults, not law — staff edit them in the admin panel, and the `authority` line is
 * there so a change can be argued against a source.
 */
export const DEFAULT_STANDARDS: DocStandard[] = [
  {
    docKind: 'passport',
    label: 'Passport',
    authority: 'German Missions in India — visa document checklist',
    rules: [
      { kind: 'required_field', field: 'passportNumber', severity: 'blocking', because: 'Without the passport number on the page I cannot tie any other document to you.' },
      { kind: 'required_field', field: 'dateOfBirth', severity: 'blocking', because: 'Your date of birth is what every other certificate is matched against.' },
      { kind: 'not_expired', field: 'expiry', severity: 'blocking', because: 'A visa cannot be issued in a passport that expires within the stay. Renew it before anything else — it gates the whole plan.' },
      { kind: 'max_age_months', field: 'expiry', value: -12, severity: 'warning', because: 'Your passport expires within a year. Most consulates want validity well past your arrival, so renew it now rather than mid-application.' },
      { kind: 'min_legible_length', value: 200, severity: 'blocking', because: 'The scan did not produce readable text. Photograph the page flat, in daylight, with all four corners visible.' },
    ],
  },
  {
    docKind: 'language_certificate',
    label: 'German or English language certificate',
    authority: 'Anerkennung offices (NRW, Bavaria) and uni-assist — accepted test providers',
    rules: [
      {
        kind: 'issuer_allowed',
        field: 'testName',
        options: ['goethe', 'telc', 'ösd', 'osd', 'testdaf', 'dsh', 'ielts', 'toefl', 'pte', 'duolingo'],
        severity: 'blocking',
        because: 'German authorities accept Goethe, telc, ÖSD, TestDaF and DSH for German, and IELTS, TOEFL or PTE for English. A certificate from a private academy is not recognised, whatever it says on it.',
      },
      { kind: 'required_field', field: 'level', severity: 'blocking', because: 'The certificate has to state the level it certifies.' },
      { kind: 'min_level', field: 'level', value: 'B1', severity: 'warning', because: 'B1 is the floor for most routes, and nursing needs B2 before the licence to practise.' },
      { kind: 'max_age_months', field: 'dateIssued', value: 24, severity: 'warning', because: 'Most authorities treat a language certificate older than two years as stale, and some refuse it outright.' },
      { kind: 'name_matches_passport', field: 'holderName', severity: 'blocking', because: 'The name must match your passport exactly. A mismatch here is the single most common reason a file is sent back.' },
    ],
  },
  {
    docKind: 'experience_letter',
    label: 'Experience or service letter',
    authority: 'Anerkennung offices — evidence of practice',
    rules: [
      { kind: 'required_field', field: 'employer', severity: 'blocking', because: 'The letter has to name the employer on its own letterhead.' },
      { kind: 'required_field', field: 'startDate', severity: 'blocking', because: 'Without a start date the period cannot be counted towards your experience.' },
      { kind: 'has_signature_or_stamp', severity: 'blocking', because: 'An unsigned, unstamped letter is a draft. It needs the signature and seal of the issuing authority.' },
      { kind: 'max_age_months', field: 'dateIssued', value: 12, severity: 'warning', because: 'A letter older than a year is usually asked for again, freshly dated.' },
      { kind: 'name_matches_passport', field: 'holderName', severity: 'blocking', because: 'The name on the letter must match your passport.' },
    ],
  },
  {
    docKind: 'registration_certificate',
    label: 'Nursing council registration',
    authority: 'Anerkennung offices — proof of the right to practise at home',
    rules: [
      { kind: 'required_field', field: 'registrationNumber', severity: 'blocking', because: 'The registration number is what the German office verifies with your council.' },
      { kind: 'required_field', field: 'council', severity: 'blocking', because: 'The issuing council has to be named so it can be contacted.' },
      { kind: 'not_expired', field: 'expiry', severity: 'blocking', because: 'Your registration must still be live. A lapsed registration cannot support an Anerkennung application.' },
      { kind: 'name_matches_passport', field: 'holderName', severity: 'blocking', because: 'The name must match your passport.' },
    ],
  },
  {
    docKind: 'degree_certificate',
    label: 'Degree certificate',
    authority: 'uni-assist and anabin — evidence of the qualification',
    rules: [
      { kind: 'required_field', field: 'institution', severity: 'blocking', because: 'The awarding university has to be named so it can be checked in anabin.' },
      { kind: 'required_field', field: 'qualification', severity: 'blocking', because: 'The certificate has to say what was awarded.' },
      { kind: 'required_field', field: 'year', severity: 'warning', because: 'The year of award is normally required on the application form.' },
      { kind: 'name_matches_passport', field: 'holderName', severity: 'blocking', because: 'The name must match your passport.' },
    ],
  },
  {
    docKind: 'diploma_certificate',
    label: 'Diploma certificate',
    authority: 'Anerkennung offices and anabin',
    rules: [
      { kind: 'required_field', field: 'institution', severity: 'blocking', because: 'The awarding institution has to be named so it can be checked.' },
      { kind: 'required_field', field: 'qualification', severity: 'blocking', because: 'The certificate has to say what was awarded.' },
      { kind: 'name_matches_passport', field: 'holderName', severity: 'blocking', because: 'The name must match your passport.' },
    ],
  },
  {
    docKind: 'transcript',
    label: 'Transcript or marksheet',
    authority: 'uni-assist — grade conversion evidence',
    rules: [
      { kind: 'required_field', field: 'grade', severity: 'blocking', because: 'Without the grade printed on the page, the German grade cannot be computed and uni-assist will not convert it for you.' },
      { kind: 'required_field', field: 'institution', severity: 'warning', because: 'The institution should appear on the transcript itself, not only on the covering certificate.' },
      { kind: 'name_matches_passport', field: 'holderName', severity: 'blocking', because: 'The name must match your passport.' },
    ],
  },
  {
    docKind: 'aps_certificate',
    label: 'APS certificate',
    authority: 'Akademische Prüfstelle, New Delhi',
    rules: [
      { kind: 'issuer_allowed', field: 'issuer', options: ['aps', 'akademische', 'prüfstelle', 'pruefstelle', 'german embassy', 'deutsche botschaft'], severity: 'blocking', because: 'Only the Akademische Prüfstelle issues this. Anything else is not an APS certificate, whatever it is titled.' },
      { kind: 'required_field', field: 'dateIssued', severity: 'warning', because: 'The issue date is on the form and the university will ask for it.' },
      { kind: 'name_matches_passport', field: 'holderName', severity: 'blocking', because: 'The name must match your passport.' },
    ],
  },
];

export const STANDARD_BY_KIND = new Map(DEFAULT_STANDARDS.map((s) => [s.docKind, s]));

export interface CheckedField {
  rule: RuleKind;
  field: string | null;
  passed: boolean;
  severity: StandardRule['severity'];
  /** What we found, as a person would read it. */
  found: string;
  /** What the rule wanted. */
  expected: string;
  because: string;
}

export interface DocVerdict {
  docKind: DocKind;
  standard: string;
  authority: string;
  /** 'accepted' | 'accepted_with_notes' | 'not_accepted' */
  verdict: 'accepted' | 'accepted_with_notes' | 'not_accepted';
  checks: CheckedField[];
  blocking: number;
  warnings: number;
}

export interface CheckInput {
  /** The structured fields the extractor pulled off the page. */
  extracted: Record<string, unknown>;
  /** The raw text, for rules that read the page rather than a field. */
  text: string;
  /** The passport name, when we hold one, for the cross-document rule. */
  passportName?: string | null;
  /** Today, injectable so the test is not a function of the day it runs. */
  now?: Date;
}

const monthsBetween = (a: Date, b: Date) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

/**
 * Is this the same name as on the passport?
 *
 * Word order and case are noise — "NAIR ANANYA" and "Ananya Nair" are one person and every Indian
 * certificate picks its own order. A middle initial is not noise. The first version of this dropped
 * single-letter tokens, so "Ananya K Nair" matched a passport reading "Ananya Nair" and the check
 * passed on precisely the discrepancy that gets files returned from Anerkennung offices. An extra
 * or missing initial is the single most common reason an Indian applicant's file comes back.
 *
 * Nothing to compare is not a mismatch: a document we hold before the passport is unmeasured, not
 * wrong.
 */
export function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const tokens = (s: string) =>
    (s ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .sort();
  const x = tokens(a ?? '');
  const y = tokens(b ?? '');
  if (!x.length || !y.length) return true;
  return x.length === y.length && x.every((t, i) => t === y[i]);
}

/**
 * Evaluate one document against the standard for its kind.
 *
 * A missing field is a failure; a field we could not read is reported as unknown and does not pass
 * silently. The verdict is the worst thing in the list, because a document with one blocking
 * failure is not "mostly fine".
 */
export function checkDocument(standard: DocStandard, input: CheckInput): DocVerdict {
  const now = input.now ?? new Date();
  const ex = input.extracted ?? {};
  const text = input.text ?? '';
  const checks: CheckedField[] = [];

  const readField = (f?: string): string => {
    if (!f) return '';
    const v = ex[f];
    return v === null || v === undefined ? '' : String(v);
  };
  const readDate = (f?: string): Date | null => {
    const raw = readField(f);
    if (!raw) return null;
    const d = new Date(/^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : raw);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  for (const rule of standard.rules) {
    let passed = true;
    let found = '';
    let expected = '';

    switch (rule.kind) {
      case 'required_field': {
        found = readField(rule.field) || 'not found on the page';
        expected = 'present';
        passed = Boolean(readField(rule.field));
        break;
      }
      case 'not_expired': {
        const d = readDate(rule.field);
        found = d ? d.toISOString().slice(0, 10) : 'no date found';
        expected = `after ${now.toISOString().slice(0, 10)}`;
        // A date we cannot read is not a pass. It is a thing somebody has to look at.
        passed = d !== null && d > now;
        break;
      }
      case 'max_age_months': {
        const d = readDate(rule.field);
        const months = Number(rule.value ?? 12);
        found = d ? d.toISOString().slice(0, 10) : 'no date found';
        if (months < 0) {
          // Negative means "must still be valid this far ahead", used for passport validity.
          expected = `valid for at least ${Math.abs(months)} more months`;
          passed = d !== null && monthsBetween(now, d) >= Math.abs(months);
        } else {
          expected = `issued within the last ${months} months`;
          passed = d !== null && monthsBetween(d, now) <= months;
        }
        break;
      }
      case 'min_level': {
        const have = cefr(readField(rule.field));
        const need = cefr(String(rule.value ?? 'B1'));
        found = readField(rule.field) || 'no level stated';
        expected = `at least ${String(rule.value ?? 'B1')}`;
        passed = have > 0 && have >= need;
        break;
      }
      case 'min_score': {
        const have = Number(String(readField(rule.field)).replace(/[^\d.]/g, ''));
        const need = Number(rule.value ?? 0);
        found = readField(rule.field) || 'no score stated';
        expected = `at least ${need}`;
        passed = Number.isFinite(have) && have >= need;
        break;
      }
      case 'issuer_allowed': {
        const haystack = `${readField(rule.field)} ${text.slice(0, 3000)}`.toLowerCase();
        const hit = (rule.options ?? []).find((o) => haystack.includes(o.toLowerCase()));
        found = hit ? `recognised: ${hit}` : readField(rule.field) || 'issuer not identified';
        expected = `one of ${(rule.options ?? []).join(', ')}`;
        passed = Boolean(hit);
        break;
      }
      case 'name_matches_passport': {
        const onDoc = readField(rule.field);
        found = onDoc || 'no name found';
        expected = input.passportName ? `matches the passport (${input.passportName})` : 'matches your passport';
        passed = sameName(onDoc, input.passportName);
        break;
      }
      case 'has_signature_or_stamp': {
        passed = /\b(signature|signed|sd\/-|seal|stamp|authorised signatory|for and on behalf)\b/i.test(text);
        found = passed ? 'a signature or seal is mentioned on the page' : 'no signature, seal or stamp found in the text';
        expected = 'signed and stamped';
        break;
      }
      case 'min_legible_length': {
        const need = Number(rule.value ?? 200);
        found = `${text.trim().length} characters of readable text`;
        expected = `at least ${need} characters`;
        passed = text.trim().length >= need;
        break;
      }
    }

    checks.push({ rule: rule.kind, field: rule.field ?? null, passed, severity: rule.severity, found, expected, because: rule.because });
  }

  const blocking = checks.filter((c) => !c.passed && c.severity === 'blocking').length;
  const warnings = checks.filter((c) => !c.passed && c.severity === 'warning').length;

  return {
    docKind: standard.docKind,
    standard: standard.label,
    authority: standard.authority,
    verdict: blocking ? 'not_accepted' : warnings ? 'accepted_with_notes' : 'accepted',
    checks,
    blocking,
    warnings,
  };
}
