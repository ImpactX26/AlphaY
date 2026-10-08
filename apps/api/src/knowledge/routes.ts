import type { CefrLevel, DocKind, Route } from '@educaro/shared';

export type CheckId = 'papers' | 'eligibility' | 'language' | 'aps' | 'money' | 'deadline';
export type SpecialistName =
  | 'route'
  | 'exams'
  | 'scout'
  | 'jobs'
  | 'recognition'
  | 'visa'
  | 'money'
  | 'housing'
  | 'life'
  | 'writer'
  | 'interview'
  | 'factcheck';

export const SPECIALIST_LABEL: Record<SpecialistName, string> = {
  route: 'Route',
  exams: 'Exams and language',
  scout: 'University scout',
  jobs: 'Jobs and Ausbildung',
  recognition: 'Recognition',
  visa: 'Visa and papers',
  money: 'Money',
  housing: 'Housing',
  life: 'Life in Germany',
  writer: 'Writer',
  interview: 'Interview coach',
  factcheck: 'Fact-checker',
};

export interface PaperSpec {
  key: string;
  label: string;
  kinds: DocKind[];
  required: boolean;
}

export interface RouteSpec {
  route: Route;
  skill: string;
  german: { need: CefrLevel; then?: CefrLevel; why: string } | null;
  english: { need: string; why: string } | null;
  papers: PaperSpec[];
  checks: CheckId[];
  specialists: SpecialistName[];
}

const passport: PaperSpec = { key: 'passport', label: 'Passport', kinds: ['passport'], required: true };
const cv: PaperSpec = { key: 'cv', label: 'CV', kinds: ['cv'], required: true };

export const ROUTES: Record<Route, RouteSpec> = {
  nursing: {
    route: 'nursing',
    skill: 'route-nursing',
    german: { need: 'B1', then: 'B2', why: 'Nursing recognition needs B1 to start, then B2 for full registration in most states.' },
    english: null,
    papers: [
      passport,
      cv,
      { key: 'qualification', label: 'Nursing diploma or degree', kinds: ['diploma_certificate', 'degree_certificate'], required: true },
      { key: 'transcript', label: 'Marksheets or transcripts', kinds: ['transcript', 'marksheet_12'], required: true },
      { key: 'experience', label: 'Experience letters', kinds: ['experience_letter'], required: true },
      { key: 'registration', label: 'Nursing council registration', kinds: ['registration_certificate'], required: true },
      { key: 'german', label: 'German certificate', kinds: ['language_certificate'], required: true },
    ],
    checks: ['papers', 'eligibility', 'language', 'money'],
    specialists: ['route', 'exams', 'recognition', 'jobs', 'visa', 'money', 'housing', 'life'],
  },
  study: {
    route: 'study',
    skill: 'route-study-india',
    german: null,
    english: { need: 'IELTS 6.5', why: 'English-taught Master’s programmes usually ask for IELTS 6.5 or TOEFL iBT 90.' },
    papers: [
      passport,
      cv,
      { key: 'qualification', label: 'Degree certificate', kinds: ['degree_certificate'], required: true },
      { key: 'transcript', label: 'Semester transcripts', kinds: ['transcript'], required: true },
      { key: 'school', label: 'Class 10 and 12 marksheets', kinds: ['marksheet_10', 'marksheet_12'], required: true },
      { key: 'english', label: 'English test report', kinds: ['language_certificate'], required: true },
      { key: 'aps', label: 'APS certificate', kinds: ['aps_certificate'], required: true },
    ],
    checks: ['papers', 'eligibility', 'language', 'aps', 'money', 'deadline'],
    specialists: ['route', 'exams', 'scout', 'visa', 'money', 'housing', 'life'],
  },
  ausbildung: {
    route: 'ausbildung',
    skill: 'route-ausbildung',
    german: { need: 'B1', why: 'Most Ausbildung places and the Ausbildung visa expect German at B1.' },
    english: null,
    papers: [
      passport,
      cv,
      { key: 'school', label: 'Class 10 and 12 marksheets', kinds: ['marksheet_10', 'marksheet_12'], required: true },
      { key: 'german', label: 'German certificate', kinds: ['language_certificate'], required: true },
    ],
    checks: ['papers', 'eligibility', 'language', 'money'],
    specialists: ['route', 'exams', 'jobs', 'visa', 'money', 'housing', 'life'],
  },
  skilled_job: {
    route: 'skilled_job',
    skill: 'route-skilled-job',
    german: { need: 'B1', why: 'Employers outside IT usually expect B1. IT roles can start with English.' },
    english: null,
    papers: [
      passport,
      cv,
      { key: 'qualification', label: 'Degree certificate', kinds: ['degree_certificate', 'diploma_certificate'], required: true },
      { key: 'transcript', label: 'Transcripts', kinds: ['transcript'], required: false },
      { key: 'experience', label: 'Experience letters', kinds: ['experience_letter'], required: true },
    ],
    checks: ['papers', 'eligibility', 'language', 'money'],
    specialists: ['route', 'exams', 'jobs', 'recognition', 'visa', 'money', 'housing', 'life'],
  },
  chancenkarte: {
    route: 'chancenkarte',
    skill: 'chancenkarte-points',
    german: { need: 'A1', why: 'The Opportunity Card needs German A1 or English B2 as a baseline.' },
    english: null,
    papers: [
      passport,
      cv,
      { key: 'qualification', label: 'Degree or vocational certificate', kinds: ['degree_certificate', 'diploma_certificate'], required: true },
      { key: 'experience', label: 'Experience letters', kinds: ['experience_letter'], required: false },
      { key: 'language', label: 'Language certificate', kinds: ['language_certificate'], required: true },
    ],
    checks: ['papers', 'eligibility', 'language', 'money'],
    specialists: ['route', 'exams', 'jobs', 'visa', 'money', 'housing', 'life'],
  },
};
