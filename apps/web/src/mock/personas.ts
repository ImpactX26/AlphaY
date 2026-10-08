/**
 * Mock fixtures. Persona copy lives ONLY here: in live mode the agent writes every word.
 * Based on the example screens, truth map and requirement matrix in educaro_applicant_flow_v2.html.
 */
import type {
  ApplicantDTO,
  DocKind,
  FactDTO,
  FileDTO,
  GapDTO,
  MailTrackerDetailDTO,
  MatchDTO,
  OpeningDTO,
  QuestionDTO,
  ReadinessDTO,
  ServiceRef,
  ShortlistDTO,
  SourceKind,
  Tag,
  TraceDTO,
  TruthRow,
} from '@educaro/shared';
import {
  daysAgo,
  daysFromNow,
  DB_VERSION,
  hoursAgo,
  minutesAgo,
  type MockApplicant,
  type MockDB,
  type MockUser,
} from './db';

export const DEMO_INBOX = 'demo-inbox@educaro.test';
export const EDUCARO_FROM = 'Educaro <agent@educaro.test>';
export const MAILPIT_URL = 'http://localhost:8025';

// ---------- Educaro services ----------
export const SERVICES = {
  nursing: { id: 'svc_nursing', name: 'Educaro Nursing Program', url: 'https://www.educaro.de/india/' },
  ausbildung: { id: 'svc_ausbildung', name: 'Ausbildung program', url: 'https://www.educaro.de/india/' },
  study: { id: 'svc_study', name: 'Study guidance', url: 'https://www.educaro.de/india/' },
  skilled: { id: 'svc_skilled', name: 'Skilled worker placement', url: 'https://www.educaro.de/fachkrafte/' },
  german: { id: 'svc_german', name: 'German course A1 to B2 (online)', url: 'https://www.educaro.de/sprachkurse/' },
  osd: { id: 'svc_osd', name: 'ÖSD exam at Educaro', url: 'https://www.educaro.de/sprachkurse/' },
  anerkennung: { id: 'svc_anerkennung', name: 'Anerkennung via educaro Akademie', url: 'https://www.educaro.de/anerkennung/' },
  consultant: { id: 'svc_consultant', name: 'Consultant call', url: 'https://www.educaro.de/india/' },
  workshop: { id: 'svc_workshop', name: 'Intercultural workshop', url: 'https://www.educaro.de/' },
  companion: { id: 'svc_companion', name: 'Integration companion', url: 'https://www.educaro.de/' },
} satisfies Record<string, ServiceRef>;

// ---------- small constructors ----------
export function fact(
  id: string,
  key: string,
  label: string,
  value: string,
  tag: Tag,
  sourceKind: SourceKind,
  sourceRef: string | null,
  createdAt: string,
  extra: { sourceUrl?: string; quote?: string } = {},
): FactDTO {
  return { id, key, label, value, tag, sourceKind, sourceRef, sourceUrl: extra.sourceUrl ?? null, quote: extra.quote ?? null, createdAt };
}

export function fileDto(
  id: string,
  originalName: string,
  mime: string,
  size: number,
  kind: DocKind,
  kindLabel: string | null,
  status: FileDTO['status'],
  confidence: number | null,
  createdAt: string,
): FileDTO {
  return { id, originalName, mime, size, kind, kindLabel, status, confidence, createdAt };
}

let traceSeq = 0;
export function traceRow(
  applicantId: string | null,
  kind: TraceDTO['kind'],
  name: string,
  detail: Record<string, unknown>,
  costUsd: number,
  createdAt: string,
  runId: string | null = null,
): TraceDTO {
  traceSeq += 1;
  return { id: `tr_${applicantId ?? 'sys'}_${traceSeq}_${Math.random().toString(36).slice(2, 6)}`, applicantId, runId, kind, name, detail, costUsd, createdAt };
}

function question(id: string, prompt: string, why: string, options: string[], factKey: string | null, createdAt: string): QuestionDTO {
  return { id, prompt, why, options, factKey, status: 'open', answer: null, createdAt };
}

// =====================================================================================
// Ananya Nair: GNM nurse, Kochi. Starts empty (demo: she uploads a video and seven files).
// =====================================================================================

export const ANANYA_ID = 'app_ananya';
export const ANANYA_DOC_ORDER: DocKind[] = ['cv', 'diploma_certificate', 'transcript', 'experience_letter', 'passport', 'marksheet_12', 'payslip'];
export const ANANYA_KIND_LABEL: Partial<Record<DocKind, string>> = {
  video: 'Intro video',
  cv: 'CV, 2 pages',
  diploma_certificate: 'GNM diploma certificate',
  transcript: 'GNM marksheets, years 1 to 3',
  experience_letter: 'Experience letter · Aster Medcity',
  passport: 'Indian passport',
  marksheet_12: 'Kerala class 12 marksheet',
  payslip: 'Payslip · Aster Medcity',
  language_certificate: 'Language certificate',
  registration_certificate: 'Kerala Nursing Council registration',
};

export const ANANYA_TRANSCRIPT =
  "Hi, I'm Ananya Nair from Kochi. I finished my GNM nursing diploma in 2021 and since then I have worked as a staff nurse at Aster Medcity, about three years now, mostly on the medical ward with older patients. I loved caring for them. Why Germany? My sister lives in Cologne. She works in IT there and she keeps telling me how much they need nurses, especially in elderly care. I finished A2 German last year. In two years I want to be working as a recognised nurse in Germany, in elderly care, near my sister.";

/** Facts that appear when each source is read. */
export function ananyaFactsFor(kind: DocKind, at: string): FactDTO[] {
  switch (kind) {
    case 'video':
      return [
        fact('f_a_goal', 'goal', 'Goal', 'Work as a recognised nurse in elderly care in Germany', 'said', 'video', 'Intro video 0:58', at, { quote: 'In two years I want to be working as a recognised nurse in Germany, in elderly care' }),
        fact('f_a_sister', 'family_germany', 'Family in Germany', 'Sister lives in Cologne', 'said', 'video', 'Intro video 0:31', at, { quote: 'My sister lives in Cologne.' }),
        fact('f_a_german_video', 'german_level', 'German level', 'A2 (said, no certificate)', 'said', 'video', 'Intro video 0:44', at, { quote: 'I finished A2 German last year.' }),
        fact('f_a_exp_video', 'experience_years', 'Experience', 'About three years', 'said', 'video', 'Intro video 0:14', at, { quote: 'about three years now, mostly on the medical ward with older patients' }),
        fact('f_a_elderly', 'care_focus', 'Care focus', 'Older patients on a medical ward', 'said', 'video', 'Intro video 0:19', at, { quote: 'mostly on the medical ward with older patients. I loved caring for them.' }),
      ];
    case 'cv':
      return [
        fact('f_a_name_cv', 'name', 'Name', 'Ananya Nair', 'said', 'cv', 'CV page 1', at),
        fact('f_a_exp_cv', 'experience', 'Experience, Aster Medcity', 'Staff nurse, 2021 to 2023', 'said', 'cv', 'CV page 1', at),
        fact('f_a_german_cv', 'german_cv', 'German on CV', 'A1', 'said', 'cv', 'CV page 2', at),
        fact('f_a_gnm_cv', 'gnm_cv', 'Nursing diploma on CV', 'GNM, 2021', 'said', 'cv', 'CV page 1', at),
      ];
    case 'diploma_certificate':
      return [
        fact('f_a_gnm', 'gnm_diploma', 'GNM nursing diploma', 'General Nursing and Midwifery, 2021, Kerala Nurses and Midwives Council', 'verified', 'document', 'GNM diploma certificate', at),
        fact('f_a_name_dip', 'name_diploma', 'Name on diploma', 'ANANYA P.', 'verified', 'document', 'GNM diploma certificate', at),
      ];
    case 'transcript':
      return [fact('f_a_marks', 'gnm_marks', 'GNM marks', 'Passed all three years, 74% aggregate', 'verified', 'document', 'GNM marksheets', at)];
    case 'experience_letter':
      return [
        fact('f_a_exp', 'experience_letter', 'Experience, Aster Medcity', 'Staff nurse, internal medicine ward, Jul 2021 to Aug 2024', 'verified', 'document', 'Experience letter · Aster Medcity', at),
      ];
    case 'passport':
      return [fact('f_a_name_pp', 'name_passport', 'Name on passport', 'ANANYA NAIR', 'verified', 'document', 'Indian passport', at)];
    case 'marksheet_12':
      return [fact('f_a_12', 'class_12', 'Class 12', 'Kerala Higher Secondary, Science (Biology), 2018', 'verified', 'document', 'Class 12 marksheet', at)];
    case 'payslip':
      return [fact('f_a_salary', 'salary_india', 'Current salary', '₹32,000 a month (Aug 2024)', 'verified', 'document', 'Payslip · Aster Medcity', at)];
    default:
      return [];
  }
}

/** The truth map, lit up row by row as sources are read. */
export function ananyaTruth(read: Set<string>, answers: Record<string, string>): TruthRow[] {
  const rows: TruthRow[] = [];
  const v = read.has('video');
  const cv = read.has('cv');
  if (read.has('diploma_certificate') || (cv && v)) {
    const doc = read.has('diploma_certificate') ? (read.has('transcript') ? 'Certificate and marksheets' : 'Certificate') : null;
    rows.push({
      key: 'gnm',
      label: 'GNM nursing diploma',
      video: v ? '"my GNM nursing diploma"' : null,
      cv: cv ? 'GNM, 2021' : null,
      document: doc,
      status: doc ? 'verified' : 'said',
      note: doc ? 'Proved by the certificate.' : 'Waiting for the certificate.',
    });
  }
  if (read.has('experience_letter') || (cv && v)) {
    const letter = read.has('experience_letter');
    const fixed = answers.q_a_exp === 'fixed';
    rows.push({
      key: 'experience',
      label: 'Experience, Aster Medcity',
      video: v ? '"about three years"' : null,
      cv: cv ? (fixed ? 'Jul 2021 to Aug 2024 (fixed)' : '2021 to 2023') : null,
      document: letter ? 'Letter: Jul 2021 to Aug 2024' : null,
      status: letter ? (cv && !fixed ? 'conflict' : 'verified') : 'said',
      note: !letter
        ? 'Waiting for the experience letter.'
        : fixed
          ? 'CV fixed to match the letter: 3 years 1 month.'
          : cv
            ? 'CV is a year short. Ask once, then fix the CV.'
            : 'Proved by the letter.',
      questionId: letter && cv && !fixed ? 'q_a_exp' : null,
    });
  }
  if (v || cv) {
    rows.push({
      key: 'german',
      label: 'German level',
      video: v ? '"I finished A2"' : null,
      cv: cv ? 'A1' : null,
      document: null,
      status: 'no_proof',
      note: 'Ask for the certificate or plan the exam.',
    });
  }
  if (read.has('passport') || read.has('diploma_certificate')) {
    const both = read.has('passport') && read.has('diploma_certificate');
    const explained = answers.q_a_name === 'explained';
    const docs = [read.has('passport') ? 'Passport ANANYA NAIR' : null, read.has('diploma_certificate') ? 'diploma ANANYA P.' : null]
      .filter(Boolean)
      .join(', ');
    rows.push({
      key: 'name',
      label: 'Name',
      video: null,
      cv: cv ? 'Ananya Nair' : null,
      document: docs,
      status: both ? 'conflict' : 'verified',
      note: both
        ? explained
          ? 'Explained: P. is her father\'s initial. Same-person affidavit planned.'
          : 'Flag before the embassy does. Plan a same-person affidavit.'
        : 'Matches so far.',
      questionId: both && !explained ? 'q_a_name' : null,
    });
  }
  if (v) {
    rows.push({
      key: 'why',
      label: 'Why Germany',
      video: '"My sister lives in Cologne. I want elderly care."',
      cv: null,
      document: null,
      status: 'said',
      note: 'Used for route and city.',
    });
  }
  return rows;
}

export function ananyaQuestions(at: string): QuestionDTO[] {
  return [
    question(
      'q_a_exp',
      'Your experience letter says Jul 2021 to Aug 2024. Your CV says 2023. Which is right?',
      'Employers and the recognition office compare these dates. One answer now saves weeks later.',
      ['The letter. Fix my CV', 'Let me explain'],
      'experience',
      at,
    ),
    question(
      'q_a_name',
      'Your passport says ANANYA NAIR, but your diploma says ANANYA P. Are both you?',
      'The embassy checks that every paper names the same person. A short affidavit fixes this before it becomes a problem.',
      ['Yes. P. is my father\'s initial', 'Let me explain'],
      'name',
      at,
    ),
  ];
}

export function ananyaGaps(): GapDTO[] {
  return [
    {
      id: 'gap_a_german',
      key: 'german_b1',
      title: 'German: A2 today, B1 needed',
      what: 'Join an Educaro online B1 batch (evenings, India time), then sit the ÖSD B1 exam at Educaro. B2 follows during the adaptation period.',
      where: 'Online, with the exam at Educaro\'s ÖSD centre',
      howLong: 'About 4 months to B1',
      cost: 'Course ₹38,000 · ÖSD B1 ₹14,500',
      links: [
        { label: 'Educaro language courses', url: 'https://www.educaro.de/sprachkurse/' },
        { label: 'ÖSD Zertifikat B1', url: 'https://www.osd.at/en/exams/oesd-exams/oesd-zertifikat-b1/' },
      ],
      service: SERVICES.german,
      status: 'open',
      shortlistId: null,
    },
    {
      id: 'gap_a_council',
      key: 'registration',
      title: 'Nursing council registration certificate',
      what: 'Request a copy of your Kerala Nurses and Midwives Council registration. The recognition office asks for it with your diploma.',
      where: 'Kerala Nurses and Midwives Council, Thiruvananthapuram (online request)',
      howLong: '2 to 3 weeks',
      cost: 'About ₹1,000',
      links: [{ label: 'Kerala Nurses and Midwives Council', url: 'https://www.knmc.org/' }],
      service: null,
      status: 'open',
      shortlistId: null,
    },
    {
      id: 'gap_a_affidavit',
      key: 'name_affidavit',
      title: 'Same-person affidavit for your name',
      what: 'A notarised affidavit that ANANYA P. and ANANYA NAIR are the same person, with your father\'s name.',
      where: 'Any notary in Kochi',
      howLong: '1 day',
      cost: 'About ₹500',
      links: [],
      service: null,
      status: 'open',
      shortlistId: null,
    },
    {
      id: 'gap_a_anerkennung',
      key: 'anerkennung',
      title: 'Anerkennung (recognition) of your GNM diploma',
      what: 'Educaro Akademie prepares your file for the NRW recognition office. You may get an adaptation course instead of an exam.',
      where: 'educaro Akademie, with the recognition office for North Rhine-Westphalia',
      howLong: '3 to 4 months after you apply',
      cost: 'Included in the Educaro Nursing Program',
      links: [{ label: 'Anerkennung in Deutschland', url: 'https://www.anerkennung-in-deutschland.de/' }],
      service: SERVICES.anerkennung,
      status: 'planned',
      shortlistId: null,
    },
  ];
}

export const ANANYA_READINESS: ReadinessDTO = {
  overall: 70,
  outcome: 'ready_after_plan',
  meters: [
    { label: 'Papers', value: 90 },
    { label: 'Eligibility', value: 100 },
    { label: 'German', value: 40 },
    { label: 'Money', value: 70 },
    { label: 'Visa papers', value: 50 },
  ],
};

export const ANANYA_OPENING_ID = 'open_rheinblick';

// =====================================================================================
// Rohan Mehta: B.Tech CS, Pune. Seeded complete (demo: switch to him, then shortlist RWTH).
// =====================================================================================

export const ROHAN_ID = 'app_rohan';
export const ROHAN_KIND_LABEL: Partial<Record<DocKind, string>> = {
  video: 'Intro video',
  cv: 'CV, 1 page',
  degree_certificate: 'B.Tech degree certificate · SPPU',
  transcript: 'Consolidated transcript, 8 semesters',
  marksheet_10: 'CBSE class 10 marksheet',
  marksheet_12: 'CBSE class 12 marksheet',
  passport: 'Indian passport',
  language_certificate: 'IELTS Academic test report',
  aps_certificate: 'APS certificate',
};

export const PROGRAMMES = {
  rwth: {
    id: 'prog_rwth_ds',
    title: 'MSc Data Science',
    subtitle: 'RWTH Aachen University · Aachen',
    url: 'https://www.rwth-aachen.de/go/id/bkwyq',
    why: 'Strong in machine learning and statistics. English-taught. Your 1.9 clears their 2.5 bar.',
  },
  tum: {
    id: 'prog_tum_inf',
    title: 'MSc Informatics',
    subtitle: 'Technical University of Munich · Munich',
    url: 'https://www.tum.de/en/studies/degree-programs/detail/informatics-master-of-science-msc',
    why: 'Top ranked. Aptitude assessment instead of a fixed grade cut-off.',
  },
  tud: {
    id: 'prog_tud_as',
    title: 'MSc Autonomous Systems',
    subtitle: 'TU Darmstadt · Darmstadt',
    url: 'https://www.tu-darmstadt.de/studieren/studieninteressierte/studienangebot_studiengaenge/studiengang_191488.en.jsp',
    why: 'Matches your final-year project on traffic-sign detection.',
  },
  dresden: {
    id: 'prog_tud_cs',
    title: 'MSc Computational Modeling and Simulation',
    subtitle: 'TU Dresden · Dresden',
    url: 'https://tu-dresden.de/studium/vor-dem-studium/studienangebot/sins/sins_studiengang?autoid=19125',
    why: 'Lower rent than Munich or Aachen. Strong in data and simulation.',
  },
};

export const RWTH_SOURCE = {
  url: 'https://www.rwth-aachen.de/go/id/bkwyq',
  title: 'Data Science M.Sc. · Admission requirements · RWTH Aachen',
  quote: 'Applicants with an Indian degree must submit a certificate from the Academic Evaluation Centre (APS).',
};

export function rwthMatrix(ieltsVerified: boolean, apsStarted: boolean): NonNullable<ShortlistDTO['matrix']> {
  return {
    rows: [
      { requirement: 'Bachelor', needs: 'Computer science or a related subject', has: 'B.Tech CS, degree certificate', status: 'meets', tag: 'verified', sourceUrl: PROGRAMMES.rwth.url },
      { requirement: 'Grade', needs: 'German 2.5 or better', has: '1.9, from CGPA 8.2', status: 'meets', tag: 'verified', sourceUrl: PROGRAMMES.rwth.url },
      {
        requirement: 'English',
        needs: 'IELTS 6.5 (no band below 5.5)',
        has: ieltsVerified ? 'IELTS 7.0, test report' : 'IELTS 7.0 claimed, no report',
        status: ieltsVerified ? 'meets' : 'pending',
        tag: ieltsVerified ? 'verified' : 'said',
        sourceUrl: PROGRAMMES.rwth.url,
      },
      {
        requirement: 'APS certificate',
        needs: 'Required for Indian degrees',
        has: apsStarted ? 'Booked, in progress' : 'Not started',
        status: apsStarted ? 'pending' : 'start_now',
        tag: 'web',
        sourceUrl: 'https://www.aps-india.de/',
      },
      { requirement: 'Application route', needs: 'Through RWTH online portal', has: 'Pack can be prepared', status: 'info', tag: 'web', sourceUrl: PROGRAMMES.rwth.url },
      { requirement: 'Deadline', needs: 'Winter intake 2027/28: 1 March 2027', has: 'Counted down on your screen', status: 'info', tag: 'web', sourceUrl: PROGRAMMES.rwth.url },
    ],
    exams: [
      { name: 'IELTS', status: ieltsVerified ? 'done' : 'pending' },
      { name: 'APS', status: apsStarted ? 'pending' : 'not_started' },
      { name: 'GRE', status: 'not_needed' },
      { name: 'TestDaF', status: 'not_needed' },
    ],
    deadline: { label: 'Application deadline, winter intake', date: '2027-03-01', daysLeft: null },
  };
}

function tumMatrix(ieltsVerified: boolean): NonNullable<ShortlistDTO['matrix']> {
  return {
    rows: [
      { requirement: 'Bachelor', needs: 'Informatics or closely related', has: 'B.Tech CS, degree certificate', status: 'meets', tag: 'verified', sourceUrl: PROGRAMMES.tum.url },
      { requirement: 'Aptitude', needs: 'Two-stage aptitude assessment', has: 'Grade 1.9, project on CNNs', status: 'info', tag: 'web', sourceUrl: PROGRAMMES.tum.url },
      {
        requirement: 'English',
        needs: 'IELTS 6.5',
        has: ieltsVerified ? 'IELTS 7.0, test report' : 'IELTS 7.0 claimed, no report',
        status: ieltsVerified ? 'meets' : 'pending',
        tag: ieltsVerified ? 'verified' : 'said',
        sourceUrl: PROGRAMMES.tum.url,
      },
      { requirement: 'APS certificate', needs: 'Required for Indian degrees', has: 'Not started', status: 'start_now', tag: 'web', sourceUrl: 'https://www.aps-india.de/' },
      { requirement: 'Deadline', needs: 'Winter intake: 31 May 2027', has: 'Counted down on your screen', status: 'info', tag: 'web', sourceUrl: PROGRAMMES.tum.url },
    ],
    exams: [
      { name: 'IELTS', status: ieltsVerified ? 'done' : 'pending' },
      { name: 'APS', status: 'not_started' },
      { name: 'GRE', status: 'not_needed' },
    ],
    deadline: { label: 'Application deadline, winter intake', date: '2027-05-31', daysLeft: null },
  };
}

function tudMatrix(): NonNullable<ShortlistDTO['matrix']> {
  return {
    rows: [
      { requirement: 'Bachelor', needs: 'CS, EE or mechatronics', has: 'B.Tech CS, degree certificate', status: 'meets', tag: 'verified', sourceUrl: PROGRAMMES.tud.url },
      { requirement: 'Grade', needs: 'Assessed by the committee', has: '1.9, from CGPA 8.2', status: 'meets', tag: 'verified', sourceUrl: PROGRAMMES.tud.url },
      { requirement: 'English', needs: 'B2 (school English accepted)', has: 'English-medium degree', status: 'meets', tag: 'verified', sourceUrl: PROGRAMMES.tud.url },
      { requirement: 'APS certificate', needs: 'Required for Indian degrees', has: 'Not started', status: 'start_now', tag: 'web', sourceUrl: 'https://www.aps-india.de/' },
      { requirement: 'Deadline', needs: 'Winter intake: 15 July 2027', has: 'Counted down on your screen', status: 'info', tag: 'web', sourceUrl: PROGRAMMES.tud.url },
    ],
    exams: [
      { name: 'APS', status: 'not_started' },
      { name: 'IELTS', status: 'not_needed' },
      { name: 'GRE', status: 'not_needed' },
    ],
    deadline: { label: 'Application deadline, winter intake', date: '2027-07-15', daysLeft: null },
  };
}

export function rohanShortlist(ieltsVerified: boolean): ShortlistDTO[] {
  return [
    {
      id: 'sl_r_tum',
      kind: 'programme',
      title: PROGRAMMES.tum.title,
      subtitle: PROGRAMMES.tum.subtitle,
      url: PROGRAMMES.tum.url,
      status: 'gaps',
      gapCount: ieltsVerified ? 1 : 2,
      matrix: tumMatrix(ieltsVerified),
      createdAt: daysAgo(2),
    },
    {
      id: 'sl_r_tud',
      kind: 'programme',
      title: PROGRAMMES.tud.title,
      subtitle: PROGRAMMES.tud.subtitle,
      url: PROGRAMMES.tud.url,
      status: 'gaps',
      gapCount: 1,
      matrix: tudMatrix(),
      createdAt: daysAgo(2),
    },
  ];
}

export const ROHAN_TRANSCRIPT =
  "Hello, I'm Rohan Mehta from Pune. I just finished my B.Tech in computer science engineering with a CGPA of 8.2. My final-year project was traffic sign detection with convolutional neural networks, and I did a six month internship at a software company. I scored 7 in IELTS. Why Germany? Public universities with almost no tuition fees, and a really strong research scene in AI. In two years I want to have finished a Master's in data science and be working in machine learning in Germany.";

function rohanFacts(): FactDTO[] {
  const at = daysAgo(3);
  return [
    fact('f_r_name', 'name', 'Name', 'Rohan Mehta', 'verified', 'document', 'Indian passport', at),
    fact('f_r_degree', 'degree', 'Bachelor', 'B.Tech Computer Engineering, Savitribai Phule Pune University, 2025', 'verified', 'document', 'B.Tech degree certificate', at),
    fact('f_r_cgpa', 'cgpa', 'CGPA', '8.21 of 10', 'verified', 'document', 'Consolidated transcript', at),
    fact('f_r_grade_de', 'grade_de', 'German grade', '1.9 (modified Bavarian formula)', 'verified', 'agent', 'Computed in code from the transcript', at),
    fact('f_r_ielts', 'ielts', 'IELTS', '7.0 overall (on CV, no report)', 'said', 'cv', 'CV', at),
    fact('f_r_project', 'project', 'Final-year project', 'Traffic sign detection with CNNs', 'said', 'cv', 'CV', at),
    fact('f_r_intern', 'internship', 'Internship', 'Software engineering intern, 6 months (2025)', 'said', 'cv', 'CV', at),
    fact('f_r_goal', 'goal', 'Goal', 'Master\'s in data science, then a machine learning job in Germany', 'said', 'video', 'Intro video 1:41', at, { quote: 'In two years I want to have finished a Master\'s in data science' }),
    fact('f_r_why', 'why_germany', 'Why Germany', 'Low tuition, strong AI research', 'said', 'video', 'Intro video 1:12', at, { quote: 'Public universities with almost no tuition fees, and a really strong research scene in AI.' }),
    fact('f_r_aps', 'aps', 'APS', 'Required for Indian degrees since November 2022', 'web', 'web', 'APS India', at, { sourceUrl: 'https://www.aps-india.de/', quote: 'APS certificate is mandatory for all Indian students who wish to study in Germany.' }),
    fact('f_r_blocked', 'blocked_account', 'Blocked account', '€11,904 for the first year (€992 a month)', 'web', 'web', 'Federal Foreign Office', at, { sourceUrl: 'https://india.diplo.de/in-en/service/05-VisaEinreise/-/2584268', quote: 'proof of financial resources of currently 11,904 euros per year' }),
  ];
}

function rohanTruth(ieltsVerified: boolean): TruthRow[] {
  return [
    { key: 'degree', label: 'B.Tech Computer Engineering', video: '"computer science engineering"', cv: 'B.Tech CSE, 2025', document: 'Degree certificate, SPPU', status: 'verified', note: 'Proved by the certificate.' },
    { key: 'cgpa', label: 'CGPA', video: '"8.2"', cv: '8.2', document: 'Transcript: 8.21', status: 'verified', note: '1.9 on the German scale, computed in code.' },
    ieltsVerified
      ? { key: 'ielts', label: 'IELTS', video: '"I scored 7"', cv: 'IELTS 7.0', document: 'Test report: 7.0 overall', status: 'verified', note: 'Proved by the test report.' }
      : { key: 'ielts', label: 'IELTS', video: '"I scored 7"', cv: 'IELTS 7.0', document: null, status: 'no_proof', note: 'Every programme wants the report itself. Ask for it.', questionId: 'q_r_ielts' },
    { key: 'internship', label: 'Internship', video: '"six month internship"', cv: 'Jan to Jun 2025', document: null, status: 'said', note: 'Not needed for admission. A letter would help later.' },
    { key: 'name', label: 'Name', video: null, cv: 'Rohan Mehta', document: 'Passport ROHAN MEHTA, degree ROHAN SURESH MEHTA', status: 'verified', note: 'Middle name only. Same person, no action needed.' },
    { key: 'why', label: 'Why Germany', video: '"low fees, strong AI research"', cv: null, document: null, status: 'said', note: 'Used for programme search.' },
  ];
}

export function rohanGaps(ieltsVerified: boolean, includeRwth: boolean): GapDTO[] {
  const gaps: GapDTO[] = [
    {
      id: 'gap_r_aps',
      key: 'aps',
      title: 'APS certificate: start now',
      what: 'Book APS document verification and send your transcripts. Every application waits for this certificate.',
      where: 'APS India, New Delhi (online booking, documents by courier)',
      howLong: '3 to 4 weeks',
      cost: '₹18,000',
      links: [{ label: 'APS India: apply', url: 'https://www.aps-india.de/' }],
      service: SERVICES.study,
      status: 'open',
      shortlistId: includeRwth ? 'sl_r_rwth' : 'sl_r_tum',
    },
  ];
  if (!ieltsVerified)
    gaps.push({
      id: 'gap_r_ielts',
      key: 'ielts_report',
      title: 'IELTS test report',
      what: 'Upload your IELTS Academic report. If you have not taken it, book a test date: results arrive in 3 to 5 days.',
      where: 'Upload here, or book with IDP or British Council in Pune',
      howLong: '1 day to upload, 2 weeks to retake',
      cost: 'Free to upload · ₹18,000 to retake',
      links: [{ label: 'IELTS Academic', url: 'https://ielts.org/take-a-test/test-types/ielts-academic-test' }],
      service: null,
      status: 'open',
      shortlistId: includeRwth ? 'sl_r_rwth' : 'sl_r_tum',
    });
  gaps.push({
    id: 'gap_r_pack',
    key: 'application_pack',
    title: 'Application pack and portal guide',
    what: 'Motivation letter, Europass CV, certified copies and a field-by-field guide for each university portal.',
    where: 'Educaro study guidance, then each university\'s portal',
    howLong: '1 week',
    cost: 'Included',
    links: [{ label: 'uni-assist: how it works', url: 'https://www.uni-assist.de/en/' }],
    service: SERVICES.study,
    status: 'planned',
    shortlistId: null,
  });
  return gaps;
}

export function rohanReadiness(ieltsVerified: boolean, includeRwth: boolean): ReadinessDTO {
  return {
    overall: ieltsVerified ? 74 : includeRwth ? 62 : 64,
    outcome: 'ready_after_plan',
    meters: [
      { label: 'Papers', value: ieltsVerified ? 85 : 70 },
      { label: 'Eligibility', value: 100 },
      { label: 'English', value: ieltsVerified ? 100 : 60 },
      { label: 'Money', value: 55 },
      { label: 'Visa papers', value: 35 },
    ],
  };
}

// =====================================================================================
// Pipeline extras (only staff see these)
// =====================================================================================

interface ExtraSpec {
  id: string;
  name: string;
  email: string;
  subtitle: string;
  homeCity: string;
  route: ApplicantDTO['route'];
  stage: ApplicantDTO['stage'];
  stageReason: string;
  targetCity: string | null;
  readiness: number;
  openGaps: number;
  openQuestions: number;
  pendingApprovals: number;
  conflicts: number;
  german: string;
  daysOld: number;
}

const EXTRAS: ExtraSpec[] = [
  { id: 'app_priya', name: 'Priya Sharma', email: 'priya.s@example.in', subtitle: 'Hotel management diploma · Jaipur', homeCity: 'Jaipur', route: 'ausbildung', stage: 'profiling', stageReason: 'Reading 6 files. Ausbildung (hotel) and skilled job are both still open.', targetCity: null, readiness: 34, openGaps: 2, openQuestions: 2, pendingApprovals: 0, conflicts: 1, german: 'A1', daysOld: 1 },
  { id: 'app_vikram', name: 'Vikram Singh', email: 'vikram.singh@example.in', subtitle: 'MBA · Delhi', homeCity: 'Delhi', route: 'chancenkarte', stage: 'new_story', stageReason: 'Video uploaded. No documents yet; reminder sent by email.', targetCity: 'Berlin', readiness: 12, openGaps: 0, openQuestions: 1, pendingApprovals: 0, conflicts: 0, german: 'none', daysOld: 0 },
  { id: 'app_arjun', name: 'Arjun Kumar', email: 'arjun.k@example.in', subtitle: 'ITI electrician · Chennai', homeCity: 'Chennai', route: 'skilled_job', stage: 'ready', stageReason: 'All papers verified, Goethe B1 certificate. Ready for employer matching.', targetCity: 'Stuttgart', readiness: 92, openGaps: 0, openQuestions: 0, pendingApprovals: 0, conflicts: 0, german: 'B1', daysOld: 21 },
  { id: 'app_sneha', name: 'Sneha Pillai', email: 'sneha.p@example.in', subtitle: 'B.Sc Nursing · Kottayam', homeCity: 'Kottayam', route: 'nursing', stage: 'matched', stageReason: 'Matched to St. Anna Klinik, Düsseldorf. Interview booked for next week.', targetCity: 'Düsseldorf', readiness: 88, openGaps: 1, openQuestions: 0, pendingApprovals: 1, conflicts: 0, german: 'B1', daysOld: 40 },
  { id: 'app_karthik', name: 'Karthik Rao', email: 'karthik.rao@example.in', subtitle: 'B.E. Mechanical · Bengaluru', homeCity: 'Bengaluru', route: 'study', stage: 'applied', stageReason: 'Application pack submitted to TU Dresden through uni-assist.', targetCity: 'Dresden', readiness: 81, openGaps: 1, openQuestions: 0, pendingApprovals: 0, conflicts: 0, german: 'A2', daysOld: 55 },
  { id: 'app_meera', name: 'Meera Joseph', email: 'meera.j@example.in', subtitle: 'GNM nurse · Thrissur', homeCity: 'Thrissur', route: 'nursing', stage: 'visa', stageReason: 'Contract signed. Visa appointment at VFS Bengaluru on 22 Oct.', targetCity: 'Essen', readiness: 95, openGaps: 0, openQuestions: 0, pendingApprovals: 0, conflicts: 0, german: 'B2', daysOld: 120 },
  { id: 'app_fatima', name: 'Fatima Sheikh', email: 'fatima.s@example.in', subtitle: 'B.Sc Nursing · Mumbai', homeCity: 'Mumbai', route: 'nursing', stage: 'arrived', stageReason: 'Arrived in Bonn on 1 Oct. Anmeldung booked; integration companion assigned.', targetCity: 'Bonn', readiness: 100, openGaps: 0, openQuestions: 0, pendingApprovals: 0, conflicts: 0, german: 'B2', daysOld: 200 },
];

function blankApplicant(profile: ApplicantDTO, persona: MockApplicant['persona']): MockApplicant {
  return {
    id: profile.id,
    persona,
    profile,
    files: [],
    transcript: null,
    facts: [],
    truth: [],
    questions: [],
    chat: [],
    shortlist: [],
    gaps: [],
    readiness: { overall: 0, outcome: 'ready_after_plan', meters: [] },
    approvals: [],
    emails: [],
    calendar: [],
    interviews: [],
    trace: [],
    brief: { applicantId: profile.id, who: profile.name, route: 'Not decided yet', openGaps: [], agentTried: [], questionsToAsk: [], bookedFor: null },
    screenVersion: 1,
    flags: {},
  };
}

function profileOf(p: Partial<ApplicantDTO> & Pick<ApplicantDTO, 'id' | 'name'>): ApplicantDTO {
  return {
    email: null,
    subtitle: null,
    homeCity: null,
    route: null,
    routeAlternatives: [],
    routeReasons: [],
    targetCity: null,
    stage: 'new_story',
    stageReason: null,
    mode: 'onboarding',
    staffSecondKey: false,
    submittedAt: null,
    approvedByStaffAt: null,
    cohortChannel: null,
    createdAt: daysAgo(1),
    ...p,
  };
}

export function seedAnanya(): MockApplicant {
  const a = blankApplicant(
    profileOf({
      id: ANANYA_ID,
      name: 'Ananya Nair',
      email: 'ananya@demo.educaro.test',
      subtitle: 'GNM nurse · Kochi',
      homeCity: 'Kochi',
      stage: 'new_story',
      stageReason: 'Signed up. Waiting for her video and documents.',
      createdAt: minutesAgo(30),
    }),
    'ananya',
  );
  a.chat = [
    {
      id: 'c_a_hello',
      applicantId: ANANYA_ID,
      author: 'agent',
      channel: 'web',
      text: "Hi Ananya, I'm your Educaro agent. Record a short video about yourself and drop every document you have, in any order. Phone photos are fine. I'll read everything and build your plan.",
      createdAt: minutesAgo(29),
    },
  ];
  a.brief = { applicantId: ANANYA_ID, who: 'Ananya Nair, GNM nurse from Kochi', route: 'Not decided yet', openGaps: [], agentTried: ['Sent a welcome message'], questionsToAsk: [], bookedFor: null };
  a.emails = [
    {
      id: 'em_a_welcome',
      direction: 'out',
      fromAddr: EDUCARO_FROM,
      toAddr: 'ananya@demo.educaro.test',
      subject: 'Welcome to Educaro, Ananya',
      text: 'Hi Ananya,\n\nWelcome to Educaro. Your first step takes ten minutes: record a short video about yourself and upload your documents. I will read everything and show you a plan.\n\nYour Educaro agent',
      threadKey: 'welcome-ananya',
      classified: null,
      createdAt: minutesAgo(30),
    },
  ];
  a.trace = [
    traceRow(ANANYA_ID, 'event', 'signup', { event: 'signup', channel: 'web' }, 0, minutesAgo(30)),
    traceRow(ANANYA_ID, 'email', 'send_email', { direction: 'out', to: ['ananya@demo.educaro.test'], subject: 'Welcome to Educaro, Ananya', kind: 'notification' }, 0, minutesAgo(30)),
  ];
  return a;
}

export function seedRohan(): MockApplicant {
  const a = blankApplicant(
    profileOf({
      id: ROHAN_ID,
      name: 'Rohan Mehta',
      email: 'rohan@demo.educaro.test',
      subtitle: 'B.Tech CS · Pune',
      homeCity: 'Pune',
      route: 'study',
      routeAlternatives: ['chancenkarte'],
      routeReasons: [
        'B.Tech CS with a German grade of 1.9 clears most Master\'s cut-offs',
        'English-taught programmes fit: IELTS 7.0 claimed, German not needed',
        'Goal is a machine learning job after the degree',
      ],
      targetCity: 'Aachen',
      stage: 'gap_plan',
      stageReason: 'APS not started and IELTS report missing. Plan shared with Rohan.',
      mode: 'planning',
      cohortChannel: '#study-ws27-cs',
      createdAt: daysAgo(3),
    }),
    'rohan',
  );
  const at = daysAgo(3);
  a.files = [
    fileDto('fl_r_video', 'rohan_intro.mp4', 'video/mp4', 48_200_000, 'video', 'Intro video · 2:05', 'done', 0.97, at),
    fileDto('fl_r_cv', 'Rohan_Mehta_CV.pdf', 'application/pdf', 182_000, 'cv', ROHAN_KIND_LABEL.cv ?? null, 'done', 0.98, at),
    fileDto('fl_r_degree', 'degree.jpg', 'image/jpeg', 2_400_000, 'degree_certificate', ROHAN_KIND_LABEL.degree_certificate ?? null, 'done', 0.93, at),
    fileDto('fl_r_transcript', 'transcript_all_sems.pdf', 'application/pdf', 1_100_000, 'transcript', ROHAN_KIND_LABEL.transcript ?? null, 'done', 0.95, at),
    fileDto('fl_r_10', 'IMG_20250611_101522.jpg', 'image/jpeg', 3_100_000, 'marksheet_10', ROHAN_KIND_LABEL.marksheet_10 ?? null, 'done', 0.88, at),
    fileDto('fl_r_12', 'IMG_20250611_101610.jpg', 'image/jpeg', 2_900_000, 'marksheet_12', ROHAN_KIND_LABEL.marksheet_12 ?? null, 'done', 0.9, at),
    fileDto('fl_r_passport', 'passport_scan.pdf', 'application/pdf', 640_000, 'passport', ROHAN_KIND_LABEL.passport ?? null, 'done', 0.99, at),
  ];
  a.transcript = {
    fileId: 'fl_r_video',
    text: ROHAN_TRANSCRIPT,
    segments: [
      { start: 0, end: 14, text: "Hello, I'm Rohan Mehta from Pune." },
      { start: 14, end: 40, text: 'I just finished my B.Tech in computer science engineering with a CGPA of 8.2.' },
      { start: 40, end: 70, text: 'My final-year project was traffic sign detection with convolutional neural networks, and I did a six month internship at a software company. I scored 7 in IELTS.' },
      { start: 70, end: 100, text: 'Why Germany? Public universities with almost no tuition fees, and a really strong research scene in AI.' },
      { start: 100, end: 125, text: "In two years I want to have finished a Master's in data science and be working in machine learning in Germany." },
    ],
    provider: 'groq whisper-large-v3-turbo',
  };
  a.facts = rohanFacts();
  a.truth = rohanTruth(false);
  a.questions = [
    question(
      'q_r_ielts',
      "Your CV lists IELTS 7.0, but I can't see the test report. Can you upload it?",
      'Every programme on your shortlist asks for the report itself, not a score on a CV.',
      ['Upload report', 'Not taken yet'],
      'ielts',
      daysAgo(3),
    ),
  ];
  a.shortlist = rohanShortlist(false);
  a.gaps = rohanGaps(false, false);
  a.readiness = rohanReadiness(false, false);
  a.chat = [
    { id: 'c_r_1', applicantId: ROHAN_ID, author: 'agent', channel: 'web', text: "Hi Rohan, I've read your video and seven files. Your 8.2 CGPA is 1.9 on the German scale, which clears most Master's cut-offs.", createdAt: daysAgo(3) },
    { id: 'c_r_2', applicantId: ROHAN_ID, author: 'applicant', channel: 'web', text: 'Nice! Which universities should I look at for data science?', createdAt: daysAgo(3) },
    { id: 'c_r_3', applicantId: ROHAN_ID, author: 'agent', channel: 'web', text: 'I put three on your screen with reasons. Tap Shortlist on any of them and I will read its official page and check every requirement against your papers.', createdAt: daysAgo(3) },
    { id: 'c_r_4', applicantId: ROHAN_ID, author: 'agent', channel: 'discord', text: 'Reminder: APS takes 3 to 4 weeks, and every application waits for it. Want me to put the booking on your calendar?', createdAt: daysAgo(1) },
  ];
  a.calendar = [
    { id: 'ev_r_consult', title: 'Consultant call: study plan', kind: 'event', startsAt: daysFromNow(2, 16, 30), durationMin: 30, location: 'Google Meet', description: 'Study guidance call with Educaro. Bring your shortlist questions.' },
    { id: 'ev_r_rwth', title: 'RWTH Aachen deadline (winter intake)', kind: 'deadline', startsAt: '2027-03-01T23:59:00+01:00', durationMin: 0, location: null, description: 'MSc Data Science application deadline.' },
  ];
  a.emails = [
    { id: 'em_r_welcome', direction: 'out', fromAddr: EDUCARO_FROM, toAddr: 'rohan@demo.educaro.test', subject: 'Welcome to Educaro, Rohan', text: 'Hi Rohan,\n\nWelcome to Educaro. Record your video and drop your documents, and I will build your plan.\n\nYour Educaro agent', threadKey: 'welcome-rohan', classified: null, createdAt: daysAgo(3) },
    { id: 'em_r_digest', direction: 'out', fromAddr: EDUCARO_FROM, toAddr: 'rohan@demo.educaro.test', subject: 'Your week: three things', text: '1. Book APS verification. It takes 3 to 4 weeks.\n2. Upload your IELTS report.\n3. Pick one more programme for your shortlist.\n\nReply to this mail any time; it reaches me too.', threadKey: 'digest-rohan', classified: null, createdAt: daysAgo(1) },
  ];
  a.brief = {
    applicantId: ROHAN_ID,
    who: 'Rohan Mehta, 22, B.Tech Computer Engineering (SPPU, 2025), CGPA 8.21 (German 1.9). Pune.',
    route: "Master's in Germany (data science / ML). Alternative: Chancenkarte, 4 of 6 points today.",
    openGaps: ['APS certificate not started (every application waits for it)', 'IELTS 7.0 on CV, no test report', 'Blocked account (€11,904) not yet planned'],
    agentTried: ['Asked for the IELTS report (no reply yet)', 'Shortlisted TUM and TU Darmstadt and built both requirement matrices', 'Sent a Discord reminder about APS'],
    questionsToAsk: ['Has he taken IELTS, or only planned it?', 'Can the family fund the blocked account, or is a loan needed?', 'Munich or Aachen: is rent a deciding factor?'],
    bookedFor: daysFromNow(2, 16, 30),
  };
  a.trace = rohanTrace();
  a.flags = { composed: true };
  return a;
}

function rohanTrace(): TraceDTO[] {
  const run = 'run_r_ingest';
  const t = (m: number) => daysAgo(3).replace(/T.*/, '') + `T09:${String(10 + m).padStart(2, '0')}:00.000Z`;
  return [
    traceRow(ROHAN_ID, 'move', 'stage', { from: 'profiling', to: 'gap_plan', reason: 'APS not started and IELTS report missing. Plan shared with Rohan.' }, 0, t(14), run),
    traceRow(ROHAN_ID, 'tool', 'compose_screen', { blocks: 10, headline: 'Rohan, your 8.2 CGPA is 1.9 on the German scale…' }, 0, t(13), run),
    traceRow(ROHAN_ID, 'llm', 'screen writer', { tier: 'cheap', model: 'openai/gpt-oss-120b', purpose: 'Write titles and words for 10 blocks', tokensIn: 4210, tokensOut: 690, cached: false, ms: 2140 }, 0, t(13), run),
    traceRow(ROHAN_ID, 'guard', 'two_questions', { guard: 'Two questions at a time', result: 'passed', note: '1 open question' }, 0, t(12), run),
    traceRow(ROHAN_ID, 'source', 'web_fetch', { url: 'https://www.aps-india.de/', title: 'APS India', quote: 'APS certificate is mandatory for all Indian students who wish to study in Germany.', specialist: 'exams' }, 0, t(11), run),
    traceRow(ROHAN_ID, 'source', 'web_fetch', { url: PROGRAMMES.tum.url, title: 'Informatics M.Sc. · TUM', quote: 'Proof of English language proficiency (e.g. IELTS 6.5)', specialist: 'university scout' }, 0, t(11), run),
    traceRow(ROHAN_ID, 'guard', 'no_pii_in_search', { guard: 'No personal data in web searches', result: 'passed', note: 'Query: "MSc data science Germany English-taught IELTS 6.5"' }, 0, t(10), run),
    traceRow(ROHAN_ID, 'tool', 'convert_grade', { input: { cgpa: 8.21, best: 10, pass: 4 }, output: { german: 1.9 }, formula: '1 + 3 × (10 − 8.2) ÷ (10 − 4)' }, 0, t(10), run),
    traceRow(ROHAN_ID, 'llm', 'quality: requirement read', { tier: 'quality', model: 'gpt-5-mini', purpose: 'Extract admission rules from TUM page', tokensIn: 9800, tokensOut: 840, cached: false, ms: 5100 }, 0.0123, t(9), run),
    traceRow(ROHAN_ID, 'plan', 'supervisor', { event: 'upload', moves: ['read_documents', 'run_specialists', 'ask', 'rewrite_screen'], why: 'Seven files and a video arrived. Read them, cross-check, then run exams, scout, money and route specialists.' }, 0, t(1), run),
    traceRow(ROHAN_ID, 'llm', 'supervisor plan', { tier: 'cheap', model: 'openai/gpt-oss-120b', purpose: 'Plan next moves', tokensIn: 2900, tokensOut: 310, cached: false, ms: 1320 }, 0, t(1), run),
    traceRow(ROHAN_ID, 'event', 'upload', { event: 'upload', files: 8 }, 0, t(0), run),
  ];
}

function seedExtra(s: ExtraSpec): MockApplicant {
  const a = blankApplicant(
    profileOf({
      id: s.id,
      name: s.name,
      email: s.email,
      subtitle: s.subtitle,
      homeCity: s.homeCity,
      route: s.route,
      targetCity: s.targetCity,
      stage: s.stage,
      stageReason: s.stageReason,
      mode: s.stage === 'arrived' ? 'germany' : s.stage === 'new_story' ? 'onboarding' : 'planning',
      createdAt: daysAgo(s.daysOld),
      submittedAt: ['ready', 'matched', 'applied', 'visa', 'arrived'].includes(s.stage) ? daysAgo(Math.max(1, s.daysOld - 5)) : null,
      approvedByStaffAt: ['matched', 'applied', 'visa', 'arrived'].includes(s.stage) ? daysAgo(Math.max(1, s.daysOld - 6)) : null,
    }),
    'extra',
  );
  a.extras = { readiness: s.readiness, openGaps: s.openGaps, openQuestions: s.openQuestions, pendingApprovals: s.pendingApprovals, conflicts: s.conflicts };
  a.readiness = {
    overall: s.readiness,
    outcome: s.readiness >= 90 ? 'ready' : 'ready_after_plan',
    meters: [
      { label: 'Papers', value: Math.min(100, s.readiness + 8) },
      { label: 'Eligibility', value: s.readiness > 20 ? 100 : 50 },
      { label: 'German', value: s.german === 'B2' ? 100 : s.german === 'B1' ? 75 : s.german === 'A2' ? 45 : 20 },
      { label: 'Money', value: Math.min(100, s.readiness + 5) },
      { label: 'Visa papers', value: Math.max(0, s.readiness - 10) },
    ],
  };
  a.facts = [fact(`f_${s.id}_german`, 'german_level', 'German level', s.german, s.german === 'none' ? 'said' : 'verified', s.german === 'none' ? 'video' : 'document', null, daysAgo(s.daysOld))];
  a.brief = {
    applicantId: s.id,
    who: `${s.name}, ${s.subtitle.replace(' · ', ', ')}`,
    route: s.route ?? 'Open',
    openGaps: s.openGaps ? ['See gap plan on the screen'] : [],
    agentTried: [s.stageReason],
    questionsToAsk: [],
    bookedFor: null,
  };
  a.trace = [
    traceRow(s.id, 'move', 'stage', { to: s.stage, reason: s.stageReason }, 0, hoursAgo(2 + s.daysOld)),
    traceRow(s.id, 'llm', 'supervisor plan', { tier: 'cheap', model: 'openai/gpt-oss-120b', purpose: 'Plan next moves', tokensIn: 2400, tokensOut: 280, cached: s.daysOld % 2 === 0, ms: 1100 }, 0, hoursAgo(2 + s.daysOld)),
    traceRow(s.id, 'llm', 'quality: letter', { tier: 'quality', model: 'gpt-5-mini', purpose: 'Draft and check documents', tokensIn: 6100, tokensOut: 900, cached: false, ms: 4200 }, Number((0.004 + s.readiness / 20000).toFixed(4)), hoursAgo(3 + s.daysOld)),
  ];
  if (s.id === 'app_vikram') {
    a.questions = [question('q_v_refusal', 'You mentioned a visa refusal in 2023. Which visa was it, and what reason did the embassy give?', 'A past refusal changes which papers matter. An Educaro consultant will look at it with you.', ['Schengen visit visa', 'Let me explain'], 'visa_history', hoursAgo(5))];
    a.flags = { escalation: 'Mentioned a German visa refusal in 2023. The agent must not advise on this alone.' };
  }
  if (s.id === 'app_priya') {
    a.truth = [
      { key: 'diploma', label: 'Hotel management diploma', video: '"three-year diploma"', cv: 'Diploma, 2022', document: 'Certificate, IHM Jaipur', status: 'verified', note: 'Proved by the certificate.' },
      { key: 'experience', label: 'Experience, Hotel Clarks Amer', video: '"two years"', cv: '2022 to 2024', document: 'Letter: Aug 2022 to Jan 2024', status: 'conflict', note: 'CV says 2024, letter says Jan 2024. Explained by Priya, not proved yet.' },
    ];
    a.questions = [];
    a.files = [fileDto('fl_p_payslip', 'WhatsApp Image 2026-10-07.jpeg', 'image/jpeg', 410_000, 'payslip', 'Payslip (blurry phone photo)', 'unclear', 0.41, hoursAgo(20))];
  }
  if (s.id === 'app_sneha') {
    a.approvals = [
      {
        id: 'ap_sneha_profile',
        applicantId: s.id,
        kind: 'employer_profile',
        title: 'German profile to St. Anna Klinik, Düsseldorf',
        payload: { to: 'pflege@st-anna-klinik.example', subject: 'Kandidatenprofil: Pflegefachkraft (B.Sc Nursing), Deutsch B1' },
        status: 'pending',
        needsStaff: true,
        applicantApprovedAt: hoursAgo(6),
        staffApprovedAt: null,
        createdAt: hoursAgo(7),
      },
    ];
  }
  return a;
}

export function seedFresh(): MockApplicant {
  const a = blankApplicant(
    profileOf({ id: 'app_fresh', name: 'Kavya Reddy', email: 'fresh@demo.educaro.test', subtitle: null, homeCity: null, createdAt: minutesAgo(1), stageReason: 'New account.' }),
    'fresh',
  );
  a.chat = [
    {
      id: 'c_f_hello',
      applicantId: 'app_fresh',
      author: 'agent',
      channel: 'web',
      text: "Hi, I'm your Educaro agent. No forms here: record a short video about yourself and drop your documents. I'll ask only what I can't find.",
      createdAt: minutesAgo(1),
    },
  ];
  return a;
}

// ---------- openings, matches, broadcasts, mail ----------

export function seedOpenings(): OpeningDTO[] {
  return [
    {
      id: ANANYA_OPENING_ID,
      employer: 'Rheinblick Seniorenzentrum',
      employerEmail: 'bewerbung@rheinblick-pflege.example',
      title: 'Pflegefachkraft in Anerkennung (m/w/d)',
      city: 'Köln',
      route: 'nursing',
      germanLevel: 'B1',
      startDate: '2027-09-01',
      needsRecognition: true,
      description: 'Elderly care home in Köln-Ehrenfeld, 120 residents. We support recognition (Anerkennung) with an adaptation course and paid German lessons to B2. Teamwork, patience and experience with older patients matter most.',
      keywords: ['Pflegefachkraft', 'Anerkennung', 'elderly care', 'older patients', 'teamwork', 'B1'],
      status: 'open',
      createdAt: daysAgo(6),
    },
    {
      id: 'open_stanna',
      employer: 'St. Anna Klinik',
      employerEmail: 'pflege@st-anna-klinik.example',
      title: 'Pflegefachkraft Innere Medizin (m/w/d)',
      city: 'Düsseldorf',
      route: 'nursing',
      germanLevel: 'B2',
      startDate: '2027-04-01',
      needsRecognition: true,
      description: 'Internal medicine ward, 3-shift system, recognition support and a relocation package.',
      keywords: ['Innere Medizin', 'Pflegefachkraft', 'shift work', 'B2'],
      status: 'matched',
      createdAt: daysAgo(30),
    },
    {
      id: 'open_elektro',
      employer: 'Schwabenwerk Elektrotechnik GmbH',
      employerEmail: 'jobs@schwabenwerk.example',
      title: 'Elektroniker für Energie- und Gebäudetechnik (m/w/d)',
      city: 'Stuttgart',
      route: 'skilled_job',
      germanLevel: 'B1',
      startDate: '2027-02-01',
      needsRecognition: true,
      description: 'Installation and maintenance in commercial buildings. Recognition of ITI qualifications supported.',
      keywords: ['Elektroniker', 'Gebäudetechnik', 'installation', 'B1'],
      status: 'open',
      createdAt: daysAgo(10),
    },
  ];
}

export function seedMatches(): MatchDTO[] {
  return [
    {
      id: 'm_stanna_sneha',
      openingId: 'open_stanna',
      applicantId: 'app_sneha',
      displayName: 'Sneha Pillai',
      score: 0.91,
      reasons: ['B.Sc Nursing, 4 years on an internal medicine ward (verified by letter).', 'Goethe B1 done, B2 course booked to finish before April.'],
      consent: true,
      status: 'interview',
      germanProfile: {
        headline: 'Pflegefachkraft (B.Sc Nursing, Indien) · 4 Jahre Innere Medizin · Deutsch B1, B2 im Kurs',
        sections: [
          { title: 'Berufserfahrung', lines: ['2021–2025 Staff Nurse, Innere Medizin, Caritas Hospital Kottayam'] },
          { title: 'Ausbildung', lines: ['B.Sc Nursing, Mahatma Gandhi University, 2021'] },
          { title: 'Sprachen', lines: ['Deutsch B1 (Goethe), B2-Kurs bis März 2027', 'Englisch C1', 'Malayalam (Muttersprache)'] },
        ],
      },
    },
  ];
}

export function seedMail(): MailTrackerDetailDTO[] {
  const mk = (
    mailpitId: string,
    direction: 'out' | 'in',
    from: string,
    to: string[],
    originalTo: string[],
    subject: string,
    text: string,
    applicantId: string | null,
    applicantName: string | null,
    kind: string | null,
    createdAt: string,
    attachments: { name: string; size: number }[] = [],
  ): MailTrackerDetailDTO => ({
    mailpitId,
    direction,
    from,
    to,
    originalTo,
    subject,
    snippet: text.replace(/\s+/g, ' ').slice(0, 140),
    applicantId,
    applicantName,
    kind,
    safeRedirected: originalTo.join(',') !== to.join(','),
    createdAt,
    text,
    html: null,
    attachments,
  });
  return [
    mk('mp_welcome_ananya', 'out', EDUCARO_FROM, ['ananya@demo.educaro.test'], ['ananya@demo.educaro.test'], 'Welcome to Educaro, Ananya', 'Hi Ananya,\n\nWelcome to Educaro. Your first step takes ten minutes: record a short video about yourself and upload your documents. I will read everything and show you a plan.\n\nYour Educaro agent', ANANYA_ID, 'Ananya Nair', 'notification', minutesAgo(30)),
    mk('mp_digest_rohan', 'out', EDUCARO_FROM, ['rohan@demo.educaro.test'], ['rohan@demo.educaro.test'], 'Your week: three things', '1. Book APS verification. It takes 3 to 4 weeks.\n2. Upload your IELTS report.\n3. Pick one more programme for your shortlist.\n\nReply to this mail any time; it reaches me too.', ROHAN_ID, 'Rohan Mehta', 'digest', daysAgo(1)),
    mk('mp_welcome_rohan', 'out', EDUCARO_FROM, ['rohan@demo.educaro.test'], ['rohan@demo.educaro.test'], 'Welcome to Educaro, Rohan', 'Hi Rohan,\n\nWelcome to Educaro. Record your video and drop your documents, and I will build your plan.\n\nYour Educaro agent', ROHAN_ID, 'Rohan Mehta', 'notification', daysAgo(3)),
    mk('mp_sneha_profile', 'out', 'Educaro Matching <matching@educaro.test>', [DEMO_INBOX], ['pflege@st-anna-klinik.example'], 'Kandidatenprofil: Pflegefachkraft (B.Sc Nursing), Deutsch B1', 'Sehr geehrte Damen und Herren,\n\nanbei das Profil einer Kandidatin für Ihre Stelle Pflegefachkraft Innere Medizin. Die Kandidatin hat der Weitergabe zugestimmt.\n\nMit freundlichen Grüßen\nEducaro Matching', 'app_sneha', 'Sneha Pillai', 'application', daysAgo(5), [{ name: 'Profil_Sneha_Pillai.pdf', size: 84_000 }]),
    mk('mp_sneha_reply', 'in', 'Personal St. Anna Klinik <pflege@st-anna-klinik.example>', ['matching@educaro.test'], ['matching@educaro.test'], 'Re: Kandidatenprofil: Pflegefachkraft (B.Sc Nursing), Deutsch B1', 'Vielen Dank. Wir möchten Frau Pillai gern zu einem Videointerview einladen, am Dienstag um 10 Uhr.\n\nFreundliche Grüße\nPersonalabteilung', 'app_sneha', 'Sneha Pillai', 'reply', daysAgo(3)),
    mk('mp_karthik_pack', 'out', EDUCARO_FROM, ['karthik.rao@example.in'], ['karthik.rao@example.in'], 'Your uni-assist pack for TU Dresden is ready', 'Hi Karthik,\n\nYour pack is ready: motivation letter, Europass CV, certified copies and a field-by-field guide. Please review and submit through uni-assist.\n\nYour Educaro agent', 'app_karthik', 'Karthik Rao', 'notification', daysAgo(8), [{ name: 'uni-assist-guide.pdf', size: 120_000 }]),
    mk('mp_vikram_reminder', 'out', EDUCARO_FROM, ['vikram.singh@example.in'], ['vikram.singh@example.in'], 'Two documents would unlock your plan', 'Hi Vikram,\n\nThanks for your video. Upload your MBA degree and your passport, and I can check the Opportunity Card points for you.\n\nYour Educaro agent', 'app_vikram', 'Vikram Singh', 'notification', hoursAgo(4)),
  ];
}

export function seedUsers(): MockUser[] {
  return [
    { userId: 'u_ananya', email: 'ananya@demo.educaro.test', password: 'demo', name: 'Ananya Nair', role: 'applicant', applicantId: ANANYA_ID },
    { userId: 'u_rohan', email: 'rohan@demo.educaro.test', password: 'demo', name: 'Rohan Mehta', role: 'applicant', applicantId: ROHAN_ID },
    { userId: 'u_staff', email: 'lena@educaro.test', password: 'demo', name: 'Lena Fischer', role: 'staff', applicantId: null },
    { userId: 'u_fresh', email: 'fresh@demo.educaro.test', password: 'demo', name: 'Kavya Reddy', role: 'applicant', applicantId: 'app_fresh' },
  ];
}

export function seedDb(): MockDB {
  const applicants: Record<string, MockApplicant> = {};
  for (const a of [seedAnanya(), seedRohan(), seedFresh(), ...EXTRAS.map(seedExtra)]) applicants[a.id] = a;
  return {
    v: DB_VERSION,
    seq: 1,
    users: seedUsers(),
    applicants,
    openings: seedOpenings(),
    matches: seedMatches(),
    broadcasts: [
      {
        id: 'bc_osd_dates',
        topic: 'New ÖSD B1 exam dates at Educaro in February',
        status: 'sent',
        messages: [
          { applicantId: 'app_priya', name: 'Priya Sharma', text: 'Hi Priya, Educaro added ÖSD B1 dates on 13 and 27 February. Your A1 course ends in December, so 27 February fits if you join the January B1 batch.' },
          { applicantId: 'app_karthik', name: 'Karthik Rao', text: 'Hi Karthik, new ÖSD B1 dates in February. German is optional for your Master\'s, but B1 helps for a student job in Dresden.' },
        ],
        createdAt: daysAgo(4),
      },
    ],
    mail: seedMail(),
    openaiSpent: 3.42,
  };
}
