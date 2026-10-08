import type { CefrLevel, PipelineStage, Route } from '@educaro/shared';
import { cefrIndex, parseCefr, WEEKS_PER_LEVEL } from '../knowledge/cefr';
import { CEFR } from '@educaro/shared';
import { OFFICIAL } from '../knowledge/official';
import { linksFor } from '../knowledge/providers';
import { ROUTES, type CheckId } from '../knowledge/routes';
import { convertIndianGrade } from '../knowledge/grades';
import { daysUntil } from '../knowledge/normalize';
import { bestFact, factData, type ApplicantState } from './state.service';

/**
 * Required checks, gap finder and readiness. All code. The model never decides eligibility,
 * never scores readiness and never invents a gap. It only explains them.
 */
export interface CheckResult {
  id: CheckId;
  label: string;
  status: 'pass' | 'gap' | 'unknown';
  detail: string;
}

export interface GapPlan {
  key: string;
  title: string;
  what: string;
  where: string;
  howLong: string;
  cost: string;
  links: { label: string; url: string }[];
  serviceId: string | null;
  priority: number;
  shortlistId?: string | null;
}

export interface Readiness {
  overall: number;
  outcome: 'ready' | 'ready_after_plan' | 'better_route';
  meters: { label: string; value: number }[];
}

export interface CheckReport {
  checks: CheckResult[];
  gaps: GapPlan[];
  readiness: Readiness;
  language: { proven: CefrLevel | null; claimed: CefrLevel | null; need: CefrLevel | null; final: CefrLevel | null };
}

const CHECK_LABEL: Record<CheckId, string> = {
  papers: 'All papers present?',
  eligibility: 'Eligible for this route?',
  language: 'Language high enough?',
  aps: 'APS done?',
  money: 'Money proof?',
  deadline: 'Deadline safe?',
};

function docKinds(state: ApplicantState): Set<string> {
  return new Set(state.files.filter((f) => f.status === 'done').map((f) => f.kind));
}

export function germanLevels(state: ApplicantState) {
  const facts = state.facts.filter((f) => f.key === 'language.german');
  const proven = facts
    .filter((f) => f.sourceKind === 'document')
    .map((f) => parseCefr((f.data as any)?.level ?? f.value))
    .filter(Boolean)
    .sort((a, b) => cefrIndex(b) - cefrIndex(a))[0] as CefrLevel | undefined;
  const claimed = facts
    .filter((f) => f.sourceKind !== 'document')
    .map((f) => parseCefr((f.data as any)?.level ?? f.value))
    .filter(Boolean)
    .sort((a, b) => cefrIndex(b) - cefrIndex(a))[0] as CefrLevel | undefined;
  return { proven: proven ?? null, claimed: claimed ?? null };
}

export function runChecks(state: ApplicantState): CheckReport {
  const route = (state.applicant.route ?? null) as Route | null;
  const spec = route ? ROUTES[route] : null;
  const kinds = docKinds(state);
  const checks: CheckResult[] = [];
  const gaps: GapPlan[] = [];
  const g = germanLevels(state);
  const language: CheckReport['language'] = { proven: g.proven, claimed: g.claimed, need: spec?.german?.need ?? null, final: spec?.german?.then ?? spec?.german?.need ?? null };

  // ---- conflicts become gaps with a plan, never rejections ----
  const nameRow = state.truth.rows.find((r) => r.key === 'identity.name' && r.status === 'conflict');
  if (nameRow) {
    gaps.push({
      key: 'name_affidavit',
      title: 'Your name differs across papers',
      what: 'Get a "one and the same person" affidavit from a notary, listing every spelling of your name. Upload it here.',
      where: 'Any notary in your city',
      howLong: '1 to 2 days',
      cost: 'about ₹500 to ₹1,500',
      links: [],
      serviceId: 'consultant',
      priority: 15,
    });
  }
  const expConflict = state.truth.rows.find((r) => r.key.startsWith('experience.') && r.status === 'conflict');
  if (expConflict) {
    gaps.push({
      key: 'cv_fix',
      title: 'Your CV and experience letter disagree',
      what: 'Confirm which dates are right. The writer then updates your CV so it matches your letters.',
      where: 'Here, one tap',
      howLong: 'a minute',
      cost: 'free',
      links: [],
      serviceId: null,
      priority: 12,
    });
  }

  if (!spec) {
    return {
      checks: [{ id: 'eligibility', label: CHECK_LABEL.eligibility, status: 'unknown', detail: 'Route not chosen yet' }],
      gaps,
      readiness: { overall: 0, outcome: 'ready_after_plan', meters: [] },
      language,
    };
  }

  // ---- papers ----
  const missing = spec.papers.filter((p) => p.required && !p.kinds.some((k) => kinds.has(k)));
  // A claimed language level without a certificate is handled by the language check, not as a missing paper.
  const missingPapers = missing.filter((p) => !['german', 'english', 'language', 'aps'].includes(p.key));
  checks.push({
    id: 'papers',
    label: CHECK_LABEL.papers,
    status: missingPapers.length ? 'gap' : 'pass',
    detail: missingPapers.length ? `Missing: ${missingPapers.map((p) => p.label).join(', ')}` : 'All required papers are here',
  });
  for (const p of missingPapers) {
    gaps.push({
      key: `paper_${p.key}`,
      title: `${p.label} missing`,
      what:
        p.key === 'registration'
          ? 'Upload your nursing council registration certificate. The recognition authority asks for it.'
          : `Upload your ${p.label.toLowerCase()}. A clear phone photo is fine.`,
      where: 'Here, drop the file',
      howLong: 'a few minutes',
      cost: 'free',
      links: [],
      serviceId: null,
      priority: p.key === 'passport' ? 20 : 40,
    });
  }

  // ---- eligibility ----
  const qual = bestFact(state, 'education.highest');
  const qualProven = qual?.sourceKind === 'document';
  let eligibility = qualProven ? 100 : qual ? 60 : 20;
  let eligDetail = qualProven ? `${qual!.value} (verified)` : qual ? `${qual.value} (not proven yet)` : 'No qualification found yet';
  if (route === 'nursing' && qual && !/nurs|gnm|midwi/i.test(qual.value)) {
    eligibility = 30;
    eligDetail = 'The qualification does not look like nursing';
  }
  if (route === 'study') {
    const grade = factData(state, 'education.grade');
    const conv = convertIndianGrade(String(grade.raw ?? bestFact(state, 'education.grade')?.value ?? ''), grade.scaleMax, grade.passMin);
    if (conv && conv.german > 2.5) {
      eligibility = Math.min(eligibility, 60);
      eligDetail += `; German grade ${conv.german.toFixed(1)} is above many programmes' 2.5 limit`;
    } else if (conv) eligDetail += `; German grade ${conv.german.toFixed(1)}`;
  }
  checks.push({ id: 'eligibility', label: CHECK_LABEL.eligibility, status: eligibility >= 60 ? (qualProven ? 'pass' : 'unknown') : 'gap', detail: eligDetail });

  // ---- language ----
  let langMeter = 0;
  if (spec.german) {
    const need = spec.german.need;
    const final = spec.german.then ?? need;
    const have = g.proven;
    const claim = g.claimed;
    const met = cefrIndex(have) >= cefrIndex(need);
    langMeter = Math.round(((cefrIndex(have ?? claim) + 1) / (cefrIndex(final) + 1)) * (have ? 100 : 80));
    langMeter = Math.max(0, Math.min(100, langMeter));
    checks.push({
      id: 'language',
      label: CHECK_LABEL.language,
      status: met ? 'pass' : 'gap',
      detail: `${have ? `${have} proven` : claim ? `${claim} claimed, no certificate` : 'No German yet'}; ${need} needed${spec.german.then ? `, then ${spec.german.then}` : ''}`,
    });
    if (!met) {
      const start = have ?? claim;
      const steps = Math.max(1, cefrIndex(need) - cefrIndex(start));
      if (claim && cefrIndex(claim) >= cefrIndex(need) && !have) {
        gaps.push({
          key: 'german_proof',
          title: `Prove your German ${claim}`,
          what: `Sit the ÖSD ${claim} exam at Educaro's own exam centre, or upload the certificate you have.`,
          where: 'ÖSD exam centre at Educaro',
          howLong: 'next exam date, results in about 2 weeks',
          cost: 'exam fee on educaro.de',
          links: linksFor('german_exam', 3),
          serviceId: 'osd-exam',
          priority: 18,
        });
      } else {
        const next = CEFR[Math.min(CEFR.length - 1, cefrIndex(start) + 1)];
        gaps.push({
          key: `german_${need.toLowerCase()}`,
          title: `German ${need} needed${spec.german.then ? `, then ${spec.german.then}` : ''} (${start ? `${start}${have ? '' : ' claimed'}` : 'none'} today)`,
          what: `Join an Educaro online ${next} batch${next !== need ? ` and continue to ${need}` : ''}, then sit the ÖSD ${need} exam at Educaro's own exam centre.`,
          where: 'Educaro online batches + ÖSD exam centre at Educaro',
          howLong: `about ${steps * WEEKS_PER_LEVEL} weeks`,
          cost: 'course and exam fees on educaro.de',
          links: linksFor('german_course'),
          serviceId: 'german-courses',
          priority: 10,
        });
      }
    }
  } else if (spec.english) {
    const eng = state.facts.filter((f) => f.key === 'language.english');
    const proven = eng.find((f) => f.sourceKind === 'document');
    const claimed = eng.find((f) => f.sourceKind !== 'document');
    langMeter = proven ? 100 : claimed ? 60 : 20;
    checks.push({
      id: 'language',
      label: CHECK_LABEL.language,
      status: proven ? 'pass' : 'gap',
      detail: proven ? `${proven.value} (report on file)` : claimed ? `${claimed.value} claimed, report missing` : 'No English test yet',
    });
    if (!proven) {
      gaps.push(
        claimed
          ? {
              key: 'english_report',
              title: `${claimed.value} claimed, test report missing`,
              what: 'Upload the official Test Report Form. Universities only accept the report.',
              where: 'Your IELTS (IDP or British Council) account',
              howLong: 'a few minutes',
              cost: 'free',
              links: [],
              serviceId: null,
              priority: 20,
            }
          : {
              key: 'english_test',
              title: 'English test needed (IELTS 6.5 or TOEFL iBT 90)',
              what: 'Book IELTS Academic. Most English-taught Master’s programmes ask for 6.5 overall.',
              where: 'IDP or British Council test centres in India',
              howLong: 'test in 2 to 4 weeks, results in about 3 to 5 days',
              cost: 'about ₹18,000',
              links: [{ label: 'IELTS India', url: 'https://ielts.idp.com/india' }],
              serviceId: 'study-guidance',
              priority: 15,
            },
      );
    }
  }

  // ---- APS ----
  if (spec.checks.includes('aps')) {
    const aps = kinds.has('aps_certificate');
    checks.push({ id: 'aps', label: CHECK_LABEL.aps, status: aps ? 'pass' : 'gap', detail: aps ? 'APS certificate on file' : 'Not started' });
    if (!aps) {
      gaps.push({
        key: 'aps',
        title: 'Start APS verification this week',
        what: 'Book APS document verification. Every German university application from India waits for it.',
        where: 'APS India (aps-india.de), documents by courier',
        howLong: OFFICIAL.aps_time.value,
        cost: OFFICIAL.aps_fee.value,
        links: linksFor('aps'),
        serviceId: 'study-guidance',
        priority: 5,
      });
    }
  }

  // ---- money ----
  let moneyMeter = 70;
  if (route === 'study') {
    const blocked = state.facts.some((f) => f.key === 'finance.blocked_account');
    moneyMeter = blocked ? 100 : 30;
    checks.push({ id: 'money', label: CHECK_LABEL.money, status: blocked ? 'pass' : 'gap', detail: blocked ? 'Blocked account on file' : `Blocked account needed: ${OFFICIAL.blocked_account.value}` });
    if (!blocked) {
      gaps.push({
        key: 'blocked_account',
        title: 'Open a blocked account',
        what: `The student visa needs proof of ${OFFICIAL.blocked_account.value}. Open a blocked account (Sperrkonto) once you have an admission.`,
        where: 'Fintiba or Expatrio, opened online from India',
        howLong: '1 to 2 weeks',
        cost: `${OFFICIAL.blocked_account.value} deposit plus a small provider fee`,
        links: [...linksFor('blocked_account', 2), { label: 'Federal Foreign Office', url: OFFICIAL.blocked_account.url }],
        serviceId: 'study-guidance',
        priority: 35,
      });
    }
  } else {
    checks.push({ id: 'money', label: CHECK_LABEL.money, status: 'unknown', detail: 'Salary from the employer covers living costs; arrival costs are budgeted' });
  }

  // ---- recognition for regulated professions ----
  if (route === 'nursing') {
    const rec = state.facts.find((f) => f.key === 'recognition.status');
    if (!rec) {
      gaps.push({
        key: 'anerkennung',
        title: 'Start recognition (Anerkennung) of your nursing diploma',
        what: 'educaro Akademie prepares your recognition application. Expect a deficit notice, then an adaptation course or a knowledge exam in Germany.',
        where: 'educaro Akademie',
        howLong: 'about 3 to 4 months for the decision',
        cost: 'authority fees vary by state',
        links: linksFor('recognition_nursing'),
        serviceId: 'anerkennung',
        priority: 25,
      });
    }
  }

  // ---- deadlines ----
  if (spec.checks.includes('deadline')) {
    const soon = state.shortlist
      .map((s) => ({ s, days: daysUntil(((s.matrix as any)?.deadline?.date as string) ?? null) }))
      .filter((x) => x.days != null)
      .sort((a, b) => a.days! - b.days!)[0];
    if (!soon) checks.push({ id: 'deadline', label: CHECK_LABEL.deadline, status: 'unknown', detail: 'Shortlist a programme to see its deadline' });
    else {
      const apsPending = !kinds.has('aps_certificate');
      const risky = soon.days! < (apsPending ? 45 : 14);
      checks.push({ id: 'deadline', label: CHECK_LABEL.deadline, status: risky ? 'gap' : 'pass', detail: `${soon.s.title}: ${soon.days} days left` });
      if (risky) {
        gaps.push({
          key: 'deadline_risk',
          title: `${soon.days} days to the ${soon.s.title} deadline`,
          what: apsPending ? 'APS takes weeks. Start it today, and prepare the rest of the pack in parallel.' : 'Finish the application pack this week.',
          where: 'Here',
          howLong: `${soon.days} days left`,
          cost: '',
          links: [{ label: 'Programme page', url: soon.s.url }],
          serviceId: 'study-guidance',
          priority: 1,
          shortlistId: soon.s.id,
        });
      }
    }
  }

  // ---- readiness, computed from the checks ----
  const required = spec.papers.filter((p) => p.required);
  const papersMeter = Math.round((required.filter((p) => p.kinds.some((k) => kinds.has(k))).length / required.length) * 100);
  const passport = kinds.has('passport');
  const advanced = ['matched', 'applied', 'visa', 'arrived'].includes(state.applicant.stage);
  const visaMeter = (passport ? 50 : 10) + (advanced ? 50 : 0);
  const meters = [
    { label: 'Papers', value: papersMeter },
    { label: 'Eligibility', value: eligibility },
    { label: spec.german ? 'German' : 'English', value: langMeter },
    { label: 'Money', value: moneyMeter },
    { label: 'Visa papers', value: Math.min(100, visaMeter) },
  ];
  const overall = Math.round(meters.reduce((s, m) => s + m.value, 0) / meters.length);
  const better = (state.outputs.route?.output as any)?.betterRoute;
  const outcome: Readiness['outcome'] = better ? 'better_route' : overall >= 90 && gaps.length === 0 ? 'ready' : 'ready_after_plan';

  gaps.sort((a, b) => a.priority - b.priority);
  return { checks, gaps, readiness: { overall, outcome, meters }, language };
}

const ORDER: PipelineStage[] = ['new_story', 'profiling', 'gap_plan', 'ready', 'matched', 'applied', 'visa', 'arrived'];

/** Where the applicant sits on the staff board, with the reason the agent writes on the card. */
export function stageFor(state: ApplicantState, report: CheckReport): { stage: PipelineStage; reason: string } {
  const a = state.applicant;
  if (a.mode === 'germany') return { stage: 'arrived', reason: 'Visa granted; Germany mode is on' };
  if (a.stage === 'visa') return { stage: 'visa', reason: a.stageReason ?? 'Visa in progress' };
  if (state.approvals.some((x) => x.kind === 'email' && x.status === 'sent')) return { stage: 'applied', reason: 'An application was sent after approval' };
  if (a.stage === 'matched') return { stage: 'matched', reason: a.stageReason ?? 'Matched to an opening' };
  const read = state.files.filter((f) => f.status === 'done').length;
  if (!read) return { stage: 'new_story', reason: 'Waiting for the intro video and documents' };
  const openQ = state.questions.filter((q) => q.status === 'open').length;
  if (!a.route) return { stage: 'profiling', reason: 'Reading the story; no route chosen yet' };
  if (state.truth.counts.conflicts && openQ) return { stage: 'profiling', reason: `${state.truth.counts.conflicts} conflict(s) waiting for an answer` };
  if (report.gaps.length) return { stage: 'gap_plan', reason: `${report.gaps.length} gap(s), each with a fix-it plan; top: ${report.gaps[0].title}` };
  return { stage: 'ready', reason: `Readiness ${report.readiness.overall}%, nothing left open` };
}

/** The agent only moves applicants forward; staff can drag them back. */
export function forwardOnly(current: PipelineStage, next: PipelineStage): boolean {
  return ORDER.indexOf(next) >= ORDER.indexOf(current) || ['new_story', 'profiling', 'gap_plan', 'ready'].includes(current);
}
