import type { TruthRow, DocKind } from '@educaro/shared';
import { DOC_KIND_LABEL } from '@educaro/shared';
import { parseCefr, cefrIndex } from '../knowledge/cefr';
import { compareNames, endDiffMonths, monthLabel, parseMonth, sameOrg } from '../knowledge/normalize';
import type { FactRow } from './facts.service';

/**
 * The truth map, computed in code. Three sources per fact: what they said (video), what they wrote (CV),
 * what they proved (documents). Only a document makes a fact Verified. A conflict becomes one polite question.
 */
export interface QuestionCandidate {
  id: string;
  prompt: string;
  why: string;
  options: string[];
  factKey: string | null;
  actions: Record<string, string>;
  priority: number;
}

export interface TruthAnalysis {
  rows: TruthRow[];
  candidates: QuestionCandidate[];
  counts: { verified: number; conflicts: number; noProof: number; said: number };
}

const SOFT_KEYS = ['goal.why_germany', 'family.germany', 'goal.city', 'goal.two_years', 'goal.timeline'];

const pick = (facts: FactRow[], key: string, kind: FactRow['sourceKind']) =>
  facts.filter((f) => f.key === key && f.sourceKind === kind);
const one = (facts: FactRow[], key: string, kind: FactRow['sourceKind']) => pick(facts, key, kind).at(-1) ?? null;
const d = (f: FactRow | null) => (f?.data ?? {}) as Record<string, any>;

function period(f: FactRow | null): string | null {
  if (!f) return null;
  const x = d(f);
  if (x.start || x.end) return `${monthLabel(parseMonth(x.start))} to ${x.end ? monthLabel(parseMonth(x.end)) : 'present'}`;
  return f.value;
}

function shortBy(months: number): string {
  if (months >= 10 && months <= 14) return 'a year';
  if (months >= 22 && months <= 26) return 'two years';
  return `${months} months`;
}

export function analyseTruth(facts: FactRow[], route: string | null): TruthAnalysis {
  const rows: TruthRow[] = [];
  const candidates: QuestionCandidate[] = [];

  // ---- name ----
  const nameDocs = pick(facts, 'identity.name', 'document');
  const passport = nameDocs.find((f) => d(f).docKind === 'passport') ?? null;
  const cvName = one(facts, 'identity.name', 'cv');
  if (nameDocs.length || cvName) {
    const base = passport ?? nameDocs[0] ?? null;
    const mismatches = base ? nameDocs.filter((f) => f !== base && compareNames(base.value, f.value) !== 'same') : [];
    const docText = nameDocs.length
      ? nameDocs
          .slice(0, 3)
          .map((f) => `${(DOC_KIND_LABEL[d(f).docKind as DocKind] ?? 'Document').replace(' certificate', '')} ${f.value}`)
          .join(', ')
      : null;
    if (mismatches.length && base) {
      const other = mismatches[0];
      const otherLabel = (DOC_KIND_LABEL[d(other).docKind as DocKind] ?? 'another document').toLowerCase();
      const explained = facts.some((f) => f.key === 'identity.same_person');
      rows.push({
        key: 'identity.name',
        label: 'Name',
        video: null,
        cv: cvName?.value ?? null,
        document: docText,
        status: 'conflict',
        note: explained ? 'Explained by the applicant. Same-person affidavit planned.' : 'Flag before the embassy does. Plan a same-person affidavit.',
      });
      candidates.push({
        id: 'conflict:identity.name',
        prompt: `Your ${passport ? 'passport' : 'first document'} says ${base.value}, but your ${otherLabel} says ${other.value}. Are both you?`,
        why: 'Embassies check that every paper shows the same name. A same-person affidavit fixes a mismatch.',
        options: ['Yes, both are me', 'Let me explain'],
        factKey: 'conflict:identity.name',
        actions: { 'Yes, both are me': 'name_same_person' },
        priority: 20,
      });
    } else {
      rows.push({
        key: 'identity.name',
        label: 'Name',
        video: null,
        cv: cvName?.value ?? null,
        document: docText,
        status: nameDocs.length ? 'verified' : 'no_proof',
        note: nameDocs.length ? '' : 'Upload your passport.',
      });
    }
  }

  // ---- highest qualification ----
  const eduDoc = one(facts, 'education.highest', 'document');
  const eduCv = one(facts, 'education.highest', 'cv');
  const eduVideo = one(facts, 'education.highest', 'video');
  if (eduDoc || eduCv || eduVideo) {
    rows.push({
      key: 'education.highest',
      label: eduDoc?.value ?? eduCv?.value ?? 'Highest qualification',
      video: eduVideo ? (eduVideo.quote ? `"${eduVideo.quote}"` : eduVideo.value) : null,
      cv: eduCv?.value ?? null,
      document: eduDoc ? d(eduDoc).evidence ?? eduDoc.value : null,
      status: eduDoc ? 'verified' : 'no_proof',
      note: eduDoc ? '' : 'Upload the degree or diploma certificate.',
    });
    if (!eduDoc) {
      candidates.push({
        id: 'missing:education.highest',
        prompt: `Can you upload your ${eduCv?.value ?? 'degree or diploma'} certificate?`,
        why: 'Every route starts from your qualification. Only the certificate proves it.',
        options: ['Upload certificate', 'It is not issued yet'],
        factKey: 'education.highest',
        actions: {},
        priority: 40,
      });
    }
  }

  // ---- grade ----
  const gDoc = one(facts, 'education.grade', 'document');
  const gCv = one(facts, 'education.grade', 'cv');
  if (gDoc || gCv) {
    const num = (f: FactRow | null) => (f ? Number(String(f.value).match(/\d+(?:\.\d+)?/)?.[0] ?? NaN) : NaN);
    const a = num(gDoc);
    const b = num(gCv);
    const conflict = gDoc && gCv && !Number.isNaN(a) && !Number.isNaN(b) && Math.abs(a - b) > (a <= 10 ? 0.15 : 2);
    rows.push({
      key: 'education.grade',
      label: 'Final grade',
      video: null,
      cv: gCv?.value ?? null,
      document: gDoc?.value ?? null,
      status: conflict ? 'conflict' : gDoc ? 'verified' : 'no_proof',
      note: conflict ? 'The marksheet decides. Fix the CV.' : gDoc ? '' : 'Upload the final marksheet or transcript.',
    });
  }

  // ---- experience, one row per employer (clustered by name, since files are read in parallel) ----
  const expFacts = facts.filter((f) => f.key.startsWith('experience.') && f.key !== 'experience.total');
  const employerOf = (f: FactRow) => String(d(f).employer ?? f.label.replace(/^Experience,\s*/, ''));
  const clusters: FactRow[][] = [];
  for (const f of expFacts) {
    const c = clusters.find((cl) => cl.some((x) => x.key === f.key || sameOrg(employerOf(x), employerOf(f))));
    if (c) c.push(f);
    else clusters.push([f]);
  }
  const videoTotal = one(facts, 'experience.total', 'video');
  const latest = (cl: FactRow[], kind: FactRow['sourceKind']) => cl.filter((f) => f.sourceKind === kind).at(-1) ?? null;
  for (const cluster of clusters) {
    const doc = latest(cluster, 'document');
    const cv = latest(cluster, 'cv');
    const video = latest(cluster, 'video') ?? (clusters.length === 1 ? videoTotal : null);
    const key = (doc ?? cv ?? cluster[0]).key;
    const clusterKeys = [...new Set(cluster.map((f) => f.key))].join('|');
    const employer = d(doc).employer ?? d(cv).employer ?? key.replace('experience.', '');
    const videoText = video ? (video.quote ? `"${video.quote}"` : video.value) : null;
    let status: TruthRow['status'] = doc ? 'verified' : 'no_proof';
    let note = doc ? '' : 'Upload the experience letter.';
    if (doc && cv) {
      const endGap = endDiffMonths(d(cv).end, d(doc).end);
      const startGap = endDiffMonths(d(cv).start, d(doc).start);
      // Two months is the line. One month is rounding between "I joined in March" and a letter
      // dated 1 April; more than that changes the total months, which feed the Chancenkarte points
      // and an employer's own count, and the embassy compares the two documents side by side.
      if ((endGap ?? 0) >= 2 || (startGap ?? 0) >= 2) {
        status = 'conflict';
        const cvEnd = parseMonth(d(cv).end);
        const docEnd = parseMonth(d(doc).end);
        const shorter = cvEnd && docEnd && cvEnd.y * 12 + (cvEnd.m ?? 12) < docEnd.y * 12 + (docEnd.m ?? 12);
        note = shorter ? `CV is ${shortBy(endGap ?? 12)} short. Ask once, then fix the CV.` : 'CV and letter disagree. Ask once, then fix the CV.';
        candidates.push({
          id: `conflict:${key}`,
          prompt: `Your experience letter says ${period(doc)}. Your CV says ${period(cv)}. Which is right?`,
          why: 'Employers and the embassy compare your CV with your experience letters.',
          options: ['The letter. Fix my CV', 'Let me explain'],
          factKey: `conflict:${key}`,
          actions: { 'The letter. Fix my CV': `accept_document:${clusterKeys}` },
          priority: 10,
        });
      }
    }
    if (!doc && (cv || video)) {
      candidates.push({
        id: `missing:${key}`,
        prompt: `Can you upload the experience letter from ${employer}?`,
        why: 'Work experience only counts with a letter from the employer.',
        options: ['Upload letter', "I don't have one yet"],
        factKey: key,
        actions: {},
        priority: 45,
      });
    }
    rows.push({
      key,
      label: `Experience, ${employer}`,
      video: videoText,
      cv: cv ? period(cv) : null,
      document: doc ? `Letter: ${period(doc)}` : null,
      status,
      note,
    });
  }

  // ---- languages ----
  for (const lang of ['german', 'english'] as const) {
    const key = `language.${lang}`;
    const doc = one(facts, key, 'document');
    const cv = one(facts, key, 'cv');
    const video = one(facts, key, 'video');
    if (!doc && !cv && !video) continue;
    const claim = video ?? cv;
    const docLvl = parseCefr(d(doc).level ?? doc?.value);
    const claimLvl = parseCefr(d(claim).level ?? claim?.value);
    let status: TruthRow['status'] = doc ? 'verified' : 'no_proof';
    let note = '';
    if (doc && claimLvl && docLvl && cefrIndex(claimLvl) > cefrIndex(docLvl)) {
      status = 'conflict';
      note = `Certificate shows ${docLvl}. The claim says ${claimLvl}.`;
    } else if (!doc) {
      note = lang === 'german' ? 'Ask for the certificate or plan the exam.' : 'Ask for the test report.';
      const claimText = d(claim).test ? `${d(claim).test} ${d(claim).score ?? ''}`.trim() : claimLvl ?? claim?.value ?? '';
      candidates.push(
        lang === 'german'
          ? {
              id: `noproof:${key}`,
              prompt: `You said you finished ${claimLvl ?? 'a German course'}. Do you have the certificate?`,
              why: 'Only an exam certificate counts as proof of your German for visas and employers.',
              options: ['Upload certificate', 'Not taken the exam yet'],
              factKey: key,
              actions: { 'Not taken the exam yet': `no_certificate:${key}` },
              priority: 30,
            }
          : {
              id: `noproof:${key}`,
              prompt: `Your CV lists ${claimText || 'an English test'}, but I can't see the test report. Can you upload it?`,
              why: 'Universities only accept the official test report.',
              options: ['Upload report', 'Not taken yet'],
              factKey: key,
              actions: { 'Not taken yet': `no_certificate:${key}` },
              priority: 30,
            },
      );
    }
    rows.push({
      key,
      label: lang === 'german' ? 'German level' : 'English',
      video: video ? (video.quote ? `"${video.quote}"` : video.value) : null,
      cv: cv?.value ?? null,
      document: doc?.value ?? null,
      status,
      note,
    });
  }

  // ---- route specific papers ----
  if (route === 'nursing') {
    const reg = one(facts, 'registration.nursing', 'document');
    const regCv = one(facts, 'registration.nursing', 'cv');
    if (reg || regCv) {
      rows.push({
        key: 'registration.nursing',
        label: 'Nursing council registration',
        video: null,
        cv: regCv?.value ?? null,
        document: reg?.value ?? null,
        status: reg ? 'verified' : 'no_proof',
        note: reg ? '' : 'Needed for Anerkennung. Upload the registration certificate.',
      });
    }
  }
  if (route === 'study') {
    const aps = one(facts, 'aps.status', 'document');
    if (aps) rows.push({ key: 'aps.status', label: 'APS certificate', video: null, cv: null, document: aps.value, status: 'verified', note: '' });
  }

  // ---- soft facts: said only ----
  for (const key of SOFT_KEYS) {
    const v = one(facts, key, 'video') ?? one(facts, key, 'cv') ?? one(facts, key, 'applicant');
    if (!v) continue;
    rows.push({
      key,
      label: v.label,
      video: v.sourceKind === 'video' ? (v.quote ? `"${v.quote}"` : v.value) : null,
      cv: v.sourceKind === 'cv' ? v.value : null,
      document: null,
      status: 'said',
      note: key === 'goal.why_germany' || key === 'family.germany' ? 'Used for route and city.' : '',
    });
  }

  const counts = {
    verified: rows.filter((r) => r.status === 'verified').length,
    conflicts: rows.filter((r) => r.status === 'conflict').length,
    noProof: rows.filter((r) => r.status === 'no_proof').length,
    said: rows.filter((r) => r.status === 'said').length,
  };
  candidates.sort((a, b) => a.priority - b.priority);
  return { rows, candidates, counts };
}
