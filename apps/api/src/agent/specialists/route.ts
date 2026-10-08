import type { Route } from '@educaro/shared';
import { ROUTE_LABEL } from '@educaro/shared';
import { cefrIndex, parseCefr } from '../../knowledge/cefr';
import { monthsBetween, parseMonth } from '../../knowledge/normalize';
import { bestFact, type ApplicantState } from '../state.service';
import { germanLevels } from '../checks';
import type { Kit, SpecialistResult } from './kit';

/** Opportunity Card (Chancenkarte) points, scored in code. Table per make-it-in-germany.com. */
export function chancenkartePoints(state: ApplicantState) {
  const lines: { label: string; points: number }[] = [];
  const qual = bestFact(state, 'education.highest');
  const recognised = state.facts.some((f) => f.key === 'recognition.status' && /partial|full/i.test(f.value));
  if (recognised) lines.push({ label: 'Partial recognition of the qualification', points: 4 });
  if (qual && /nurs|gnm|engineer|b\.?\s?tech|computer|it\b|electric|mechanic/i.test(qual.value)) {
    lines.push({ label: 'Qualification in a shortage occupation', points: 1 });
  }
  const months = experienceMonths(state);
  if (months >= 60) lines.push({ label: 'Five or more years of experience', points: 3 });
  else if (months >= 24) lines.push({ label: 'Two or more years of experience', points: 2 });
  const { proven, claimed } = germanLevels(state);
  const de = proven ?? claimed;
  const deIdx = cefrIndex(de);
  if (deIdx >= cefrIndex('B2')) lines.push({ label: `German ${de}`, points: 3 });
  else if (deIdx >= cefrIndex('B1')) lines.push({ label: `German ${de}`, points: 2 });
  else if (deIdx >= cefrIndex('A2')) lines.push({ label: `German ${de}${proven ? '' : ' (claimed)'}`, points: 1 });
  const en = bestFact(state, 'language.english');
  const enLvl = parseCefr((en?.data as any)?.level ?? en?.value);
  const band = Number(String(en?.value ?? '').match(/(\d(?:\.\d)?)/)?.[1] ?? 0);
  if (cefrIndex(enLvl) >= cefrIndex('C1') || band >= 7) lines.push({ label: 'English C1', points: 1 });
  const age = ageYears(state);
  if (age != null && age < 35) lines.push({ label: 'Under 35', points: 2 });
  else if (age != null && age <= 40) lines.push({ label: 'Aged 35 to 40', points: 1 });
  return { total: lines.reduce((s, l) => s + l.points, 0), needed: 6, lines };
}

export function experienceMonths(state: ApplicantState): number {
  const seen = new Set<string>();
  let total = 0;
  for (const f of state.facts) {
    if (!f.key.startsWith('experience.') || f.key === 'experience.total') continue;
    if (seen.has(f.key)) continue;
    const best = bestFact(state, f.key);
    const d = (best?.data ?? {}) as Record<string, any>;
    const s = parseMonth(d.start);
    const e = parseMonth(d.end ?? 'present');
    if (s && e) {
      total += Math.max(0, monthsBetween(s, e));
      seen.add(f.key);
    }
  }
  if (!total) {
    const v = state.facts.find((f) => f.key === 'experience.total');
    const yrs = Number((v?.data as any)?.years ?? 0);
    total = yrs * 12;
  }
  return total;
}

function ageYears(state: ApplicantState): number | null {
  const dob = bestFact(state, 'identity.dob')?.value;
  const m = dob?.match(/(\d{4})/);
  if (!m) return null;
  return new Date().getFullYear() - Number(m[1]);
}

/** Route specialist: scores each route in code and explains why. */
export async function routeSpecialist(kit: Kit): Promise<SpecialistResult> {
  const s = kit.state;
  const qual = bestFact(s, 'education.highest')?.value ?? '';
  const hints = (bestFact(s, 'goal.route_hint')?.value ?? '').split(/,\s*/);
  const why = bestFact(s, 'goal.why_germany')?.value ?? '';
  const months = experienceMonths(s);
  const points = chancenkartePoints(s);
  const score: Record<Route, number> = { nursing: 0, study: 0, ausbildung: 0, skilled_job: 0, chancenkarte: 0 };
  const reasons: Record<Route, string[]> = { nursing: [], study: [], ausbildung: [], skilled_job: [], chancenkarte: [] };

  if (/nurs|gnm|midwi/i.test(qual)) {
    score.nursing += 6;
    reasons.nursing.push(`${qual} is a nursing qualification`);
  }
  if (hints.includes('nursing') || /elderly care|patients|nurs/i.test(why)) {
    score.nursing += 2;
    reasons.nursing.push('Their own words point to nursing');
  }
  if (/b\.?\s?tech|b\.?\s?e\b|bachelor|b\.?\s?sc/i.test(qual) && !/nurs/i.test(qual)) {
    score.study += 3;
    score.skilled_job += 2;
    reasons.study.push(`${qual} qualifies for a Master's`);
  }
  if (hints.includes('study') || /master|m\.?sc|study/i.test(why)) {
    score.study += 3;
    reasons.study.push('They want to study');
  }
  if (!qual && s.files.some((f) => f.kind === 'marksheet_12')) {
    score.ausbildung += 5;
    reasons.ausbildung.push('Class 12 completed, no degree: Ausbildung is the paid route');
  }
  if (hints.includes('ausbildung')) score.ausbildung += 3;
  if (months >= 24 && qual) {
    score.skilled_job += 2;
    reasons.skilled_job.push(`${Math.round(months / 12)} years of experience`);
  }
  if (hints.includes('skilled_job')) score.skilled_job += 2;
  if (points.total >= 6) {
    score.chancenkarte += 3;
    reasons.chancenkarte.push(`${points.total} Opportunity Card points (6 needed)`);
  } else score.chancenkarte += 1;

  const family = bestFact(s, 'family.germany');
  const ranked = (Object.keys(score) as Route[]).sort((a, b) => score[b] - score[a]);
  const primary = ranked[0];
  const alternatives = ranked.slice(1).filter((r) => score[r] >= score[primary] - 2 && score[r] > 1);
  const out = {
    primary,
    alternatives,
    scores: score,
    reasons: [...reasons[primary], ...(family ? [`${family.value}: shapes the city`] : [])].slice(0, 4),
    chancenkarte: points,
    betterRoute: kit.state.applicant.route && kit.state.applicant.route !== primary && score[primary] - score[kit.state.applicant.route as Route] >= 4 ? primary : null,
    label: ROUTE_LABEL[primary],
  };
  return { summary: `Route: ${ROUTE_LABEL[primary]}${alternatives.length ? ` (also ${alternatives.map((a) => ROUTE_LABEL[a]).join(', ')})` : ''}`, output: out };
}
