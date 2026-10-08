import type { DocKind } from '@educaro/shared';
import { parseCefr } from '../knowledge/cefr';
import { monthLabel, parseMonth, tidyCase } from '../knowledge/normalize';
import { convertIndianGrade } from '../knowledge/grades';
import type { FactInput } from '../profile/facts.service';
import type { CvExtraction, DocExtraction, TranscriptClaims } from './extractors';

/**
 * The German equivalent, carried on the grade fact itself.
 *
 * It is pure arithmetic over the modified Bavarian formula, so it belongs with the grade and not in
 * a sentence the agent might not write. Every university compares against this number, so it has to
 * be visible wherever the grade is.
 */
function gradeFact(base: Omit<FactInput, 'key' | 'label' | 'value'>, raw: string, scaleMax?: number | null, passMin?: number | null): FactInput {
  const conv = convertIndianGrade(raw, scaleMax, passMin);
  return {
    ...base,
    key: 'education.grade',
    label: 'Final grade',
    value: conv ? `${raw} (German ${conv.german.toFixed(1)})` : raw,
    data: { raw, scaleMax: scaleMax ?? null, passMin: passMin ?? null, german: conv?.german ?? null, formula: conv?.formula ?? null },
  };
}


const period = (start: string | null, end: string | null) =>
  `${monthLabel(parseMonth(start))} to ${end && !/present/i.test(end) ? monthLabel(parseMonth(end)) : 'present'}`;

/** The key resolver lets the caller reuse an existing experience key for the same employer. */
export type ExpKey = (employer: string) => string;

export function docFacts(e: DocExtraction, fileId: string, expKey: ExpKey): FactInput[] {
  const base = { tag: 'verified' as const, sourceKind: 'document' as const, sourceRef: fileId };
  const out: FactInput[] = [];
  const kind = e.kind as DocKind;
  if (e.holderName) out.push({ ...base, key: 'identity.name', label: 'Name', value: tidyCase(e.holderName), data: { docKind: kind, asPrinted: e.holderName } });
  switch (kind) {
    case 'passport':
      if (e.dateOfBirth) out.push({ ...base, key: 'identity.dob', label: 'Date of birth', value: e.dateOfBirth });
      out.push({
        ...base,
        key: 'identity.passport',
        label: 'Passport',
        value: e.expiry ? `Valid until ${e.expiry}` : 'Passport on file',
        data: { number: e.passportNumber, expiry: e.expiry, nationality: e.nationality, sensitive: true },
      });
      break;
    case 'degree_certificate':
    case 'diploma_certificate': {
      const q = tidyCase([e.qualification, e.field && !e.qualification?.toLowerCase().includes(e.field.toLowerCase()) ? e.field : null].filter(Boolean).join(', '));
      if (q) {
        out.push({
          ...base,
          key: 'education.highest',
          label: 'Highest qualification',
          value: `${q}${e.year ? `, ${e.year.replace(/\D*(\d{4}).*/, '$1')}` : ''}`,
          data: { qualification: e.qualification, field: e.field, institution: e.institution, year: e.year, evidence: 'Certificate', kind },
        });
      }
      if (e.grade) out.push(gradeFact(base, e.grade, e.gradeScaleMax, e.gradePassMin));
      break;
    }
    case 'transcript':
      if (e.grade) out.push(gradeFact(base, e.grade, e.gradeScaleMax, e.gradePassMin));
      if (e.qualification) out.push({ ...base, key: 'education.transcript', label: 'Transcript', value: e.qualification, data: { institution: e.institution } });
      break;
    case 'marksheet_12':
      out.push({ ...base, key: 'education.class12', label: 'Class 12', value: [e.issuer, e.grade, e.year].filter(Boolean).join(' · ') || 'Marksheet on file' });
      break;
    case 'marksheet_10':
      out.push({ ...base, key: 'education.class10', label: 'Class 10', value: [e.issuer, e.grade, e.year].filter(Boolean).join(' · ') || 'Marksheet on file' });
      break;
    case 'experience_letter':
      if (e.employer) {
        out.push({
          ...base,
          key: expKey(e.employer),
          label: `Experience, ${e.employer}`,
          value: `${period(e.startDate, e.endDate)}${e.role ? ` · ${e.role}` : ''}`,
          data: { employer: e.employer, role: e.role, start: e.startDate, end: e.endDate },
        });
      }
      break;
    case 'payslip':
      if (e.monthlySalary) out.push({ ...base, key: 'finance.salary', label: 'Current salary', value: `${e.monthlySalary} per month`, data: { employer: e.employer } });
      break;
    case 'language_certificate': {
      const lang = e.language ?? (/ielts|toefl/i.test(e.testName ?? '') ? 'english' : 'german');
      const lvl = parseCefr(e.level);
      out.push({
        ...base,
        key: `language.${lang}`,
        label: lang === 'german' ? 'German level' : 'English',
        value: [e.testName, lang === 'english' && e.score ? e.score : lvl].filter(Boolean).join(' ') || 'Certificate on file',
        data: { level: lvl, test: e.testName, score: e.score, proof: true },
      });
      break;
    }
    case 'registration_certificate':
      out.push({ ...base, key: 'registration.nursing', label: 'Nursing council registration', value: [e.council, e.registrationNumber ? `no. ${e.registrationNumber}` : null].filter(Boolean).join(', ') || 'Registration on file' });
      break;
    case 'aps_certificate':
      out.push({ ...base, key: 'aps.status', label: 'APS certificate', value: `Issued${e.dateIssued ? ` ${e.dateIssued}` : ''}` });
      break;
  }
  return out;
}

export function cvFacts(cv: CvExtraction, fileId: string, expKey: ExpKey): FactInput[] {
  const base = { tag: 'said' as const, sourceKind: 'cv' as const, sourceRef: fileId };
  const out: FactInput[] = [];
  if (cv.name) out.push({ ...base, key: 'identity.name', label: 'Name', value: cv.name });
  if (cv.email) out.push({ ...base, key: 'contact.email', label: 'Email', value: cv.email, data: { sensitive: true } });
  if (cv.phone) out.push({ ...base, key: 'contact.phone', label: 'Phone', value: cv.phone, data: { sensitive: true } });
  if (cv.city) out.push({ ...base, key: 'contact.city', label: 'Home city', value: cv.city });
  if (cv.summary) out.push({ ...base, key: 'profile.summary', label: 'Summary', value: cv.summary });
  const top = cv.education[0];
  if (top) {
    out.push({
      ...base,
      key: 'education.highest',
      label: 'Highest qualification',
      value: `${top.qualification}${top.field && !top.qualification.toLowerCase().includes(top.field.toLowerCase()) ? `, ${top.field}` : ''}${top.year ? `, ${top.year}` : ''}`,
      data: { qualification: top.qualification, field: top.field, institution: top.institution, year: top.year },
    });
    if (top.grade) out.push(gradeFact(base, top.grade));
  }
  for (const x of cv.experience) {
    out.push({
      ...base,
      key: expKey(x.employer),
      label: `Experience, ${x.employer}`,
      value: `${x.start && /^\d{4}$/.test(x.start) ? x.start : monthLabel(parseMonth(x.start))} to ${x.end ? (/present/i.test(x.end) ? 'present' : /^\d{4}$/.test(x.end) ? x.end : monthLabel(parseMonth(x.end))) : 'present'}${x.role ? ` · ${x.role}` : ''}`,
      data: { employer: x.employer, role: x.role, start: x.start, end: x.end, city: x.city },
    });
  }
  for (const l of cv.languages) {
    const lang = /german|deutsch/i.test(l.language) ? 'german' : /english/i.test(l.language) ? 'english' : null;
    if (!lang) continue;
    const lvl = parseCefr(l.level);
    out.push({
      ...base,
      key: `language.${lang}`,
      label: lang === 'german' ? 'German level' : 'English',
      value: [l.test, l.score, lvl].filter(Boolean).join(' ') || l.level || l.language,
      data: { level: lvl, test: l.test, score: l.score },
    });
  }
  if (cv.skills.length) out.push({ ...base, key: 'profile.skills', label: 'Skills', value: cv.skills.slice(0, 15).join(', ') });
  return out;
}

export function transcriptFacts(c: TranscriptClaims, fileId: string, expKey: ExpKey): FactInput[] {
  const base = { tag: 'said' as const, sourceKind: 'video' as const, sourceRef: fileId };
  const out: FactInput[] = [];
  if (c.name) out.push({ ...base, key: 'identity.name.said', label: 'Name (video)', value: c.name });
  if (c.education) out.push({ ...base, key: 'education.highest', label: 'Highest qualification', value: c.education.value, quote: c.education.quote });
  for (const x of c.experience) {
    out.push({
      ...base,
      key: x.employer ? expKey(x.employer) : 'experience.total',
      label: x.employer ? `Experience, ${x.employer}` : 'Total experience',
      value: x.durationText,
      quote: x.quote,
      data: { years: x.years, employer: x.employer },
    });
  }
  if (c.germanLevel) out.push({ ...base, key: 'language.german', label: 'German level', value: c.germanLevel.level, quote: c.germanLevel.quote, data: { level: parseCefr(c.germanLevel.level) } });
  if (c.english) out.push({ ...base, key: 'language.english', label: 'English', value: c.english.value, quote: c.english.quote });
  if (c.whyGermany) out.push({ ...base, key: 'goal.why_germany', label: 'Why Germany', value: c.whyGermany.value, quote: c.whyGermany.quote });
  if (c.familyInGermany)
    out.push({
      ...base,
      key: 'family.germany',
      label: 'Family in Germany',
      value: `${c.familyInGermany.relation[0].toUpperCase()}${c.familyInGermany.relation.slice(1)} in ${c.familyInGermany.city}`,
      quote: c.familyInGermany.quote,
      data: { relation: c.familyInGermany.relation, city: c.familyInGermany.city },
    });
  if (c.preferredCity) out.push({ ...base, key: 'goal.city', label: 'Preferred city', value: c.preferredCity.city, quote: c.preferredCity.quote });
  if (c.twoYears) out.push({ ...base, key: 'goal.two_years', label: 'In two years', value: c.twoYears.value, quote: c.twoYears.quote });
  if (c.timeline) out.push({ ...base, key: 'goal.timeline', label: 'Timeline', value: c.timeline.value, quote: c.timeline.quote });
  if (c.routeHints.length) out.push({ ...base, key: 'goal.route_hint', label: 'Route hints', value: c.routeHints.join(', ') });
  return out;
}
