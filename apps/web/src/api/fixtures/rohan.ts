import type { FactDTO, MatrixBlock, OpportunitiesBlock, ShortlistDTO, TraceDTO, TruthRow } from '@educaro/shared';
import { type ApplicantState, ago, DAY, daysUntil, MIN, SERVICES } from './common';

export const ROHAN_ID = 'app-rohan';
const id = ROHAN_ID;

const fact = (
  fid: string,
  key: string,
  label: string,
  value: string,
  tag: FactDTO['tag'],
  sourceKind: FactDTO['sourceKind'],
  sourceRef: string | null,
  quote: string | null = null,
  sourceUrl: string | null = null,
): FactDTO => ({ id: fid, key, label, value, tag, sourceKind, sourceRef, sourceUrl, quote, createdAt: ago(3 * 60 * MIN) });

const facts: FactDTO[] = [
  fact('fr-name', 'name', 'Name', 'ROHAN MEHTA', 'verified', 'document', 'Passport.pdf'),
  fact('fr-degree', 'education.bachelor', 'Bachelor', 'B.Tech Computer Engineering, Savitribai Phule Pune University, 2025', 'verified', 'document', 'BTech_Degree.pdf'),
  fact('fr-cgpa', 'education.cgpa', 'CGPA', '8.21 / 10', 'verified', 'document', 'Semester_marksheets_1-8.pdf'),
  fact('fr-grade-de', 'education.grade_de', 'German grade', '1.9 (modified Bavarian formula, computed in code)', 'verified', 'document', 'Semester_marksheets_1-8.pdf'),
  fact('fr-ielts', 'language.english', 'IELTS', '7.0 overall (no report uploaded)', 'said', 'cv', 'Rohan_Mehta_Resume.pdf'),
  fact('fr-intern', 'experience.internship', 'Internship', 'ML intern, 6 months, 2024', 'said', 'cv', 'Rohan_Mehta_Resume.pdf'),
  fact('fr-goal', 'goal', 'Goal', 'Master’s in data science, then work in Germany', 'said', 'video', 'rohan-intro.webm', 'I want to do a Master’s in data science and then work there'),
  fact('fr-ml', 'interest', 'Interests', 'Machine learning, statistics', 'said', 'video', 'rohan-intro.webm', 'mostly machine learning and statistics'),
  fact('fr-aps-web', 'rules.aps', 'APS rule', 'Indian applicants need an APS certificate for German universities.', 'web', 'web', 'aps-india.de', 'All Indian students who want to study in Germany need an APS certificate.', 'https://aps-india.de'),
];

const truth: TruthRow[] = [
  { key: 'education.bachelor', label: 'B.Tech Computer Engineering', video: '“my B.Tech in computer science”', cv: 'B.Tech CS, SPPU, 2025', document: 'Degree certificate and 8 semester transcripts', status: 'verified', note: 'Matches across all three.' },
  { key: 'education.cgpa', label: 'CGPA', video: '“around 8.2”', cv: '8.2 / 10', document: 'Transcripts: CGPA 8.21', status: 'verified', note: 'German grade 1.9, computed in code.' },
  { key: 'language.english', label: 'IELTS', video: '“I got 7 in IELTS”', cv: 'IELTS 7.0', document: null, status: 'no_proof', note: 'Upload the Test Report Form.', questionId: 'q-ro-ielts' },
  { key: 'aps', label: 'APS certificate', video: null, cv: null, document: null, status: 'no_proof', note: 'Not started. Every German university application waits for it.' },
  { key: 'experience.internship', label: 'ML internship', video: '“an internship on ML at a startup”', cv: 'ML intern, 6 months, 2024', document: null, status: 'said', note: 'Add the internship letter if you have one.' },
  { key: 'goal', label: 'Goal', video: '“a Master’s in data science, then work there”', cv: null, document: null, status: 'said', note: 'Used for the shortlist.' },
];

export const RWTH_MATRIX: Pick<MatrixBlock, 'rows' | 'exams' | 'deadline'> = {
  rows: [
    { requirement: 'Bachelor', needs: 'Computer science or related', has: 'B.Tech CS, degree certificate', status: 'meets', tag: 'verified', sourceUrl: 'https://www.rwth-aachen.de' },
    { requirement: 'Grade', needs: 'German 2.5 or better', has: '1.9, from CGPA 8.2', status: 'meets', tag: 'verified', sourceUrl: 'https://www.rwth-aachen.de' },
    { requirement: 'English', needs: 'IELTS 6.5', has: 'IELTS 7.0 claimed, no report', status: 'pending', tag: 'said', sourceUrl: 'https://www.rwth-aachen.de' },
    { requirement: 'APS certificate', needs: 'Required for Indian degrees', has: 'Not started', status: 'start_now', tag: 'web', sourceUrl: 'https://aps-india.de' },
    { requirement: 'Application route', needs: 'Through uni-assist', has: 'Pack can be prepared', status: 'info', tag: 'web', sourceUrl: 'https://www.uni-assist.de' },
    { requirement: 'Deadline', needs: 'Winter intake', has: 'Counted down on your screen', status: 'info', tag: 'web', sourceUrl: 'https://www.rwth-aachen.de' },
  ],
  exams: [
    { name: 'IELTS', status: 'pending' },
    { name: 'APS', status: 'not_started' },
    { name: 'GRE', status: 'not_needed' },
    { name: 'TestDaF', status: 'not_needed' },
  ],
  deadline: { label: 'Winter semester 2027/28 application', date: '2027-03-01', daysLeft: daysUntil('2027-03-01') },
};

const TUM_MATRIX: Pick<MatrixBlock, 'rows' | 'exams' | 'deadline'> = {
  rows: [
    { requirement: 'Bachelor', needs: 'Informatics or closely related, enough maths', has: 'B.Tech CS, 8 semesters', status: 'meets', tag: 'verified', sourceUrl: 'https://www.tum.de' },
    { requirement: 'Aptitude assessment', needs: 'Documents scored; some applicants interviewed', has: 'Pack can be prepared', status: 'info', tag: 'web', sourceUrl: 'https://www.tum.de' },
    { requirement: 'English', needs: 'IELTS 6.5', has: 'IELTS 7.0 claimed, no report', status: 'pending', tag: 'said', sourceUrl: 'https://www.tum.de' },
    { requirement: 'APS certificate', needs: 'Required for Indian degrees', has: 'Not started', status: 'start_now', tag: 'web', sourceUrl: 'https://aps-india.de' },
    { requirement: 'GRE', needs: 'Not required', has: 'Not taken', status: 'not_needed', tag: 'web', sourceUrl: 'https://www.tum.de' },
  ],
  exams: [
    { name: 'IELTS', status: 'pending' },
    { name: 'APS', status: 'not_started' },
    { name: 'GRE', status: 'not_needed' },
  ],
  deadline: { label: 'Winter semester application window closes', date: '2027-05-31', daysLeft: daysUntil('2027-05-31') },
};

const TUDA_MATRIX: Pick<MatrixBlock, 'rows' | 'exams' | 'deadline'> = {
  rows: [
    { requirement: 'Bachelor', needs: 'Computer science, electrical engineering or related', has: 'B.Tech CS, degree certificate', status: 'meets', tag: 'verified', sourceUrl: 'https://www.tu-darmstadt.de' },
    { requirement: 'English', needs: 'B2; an English-taught Bachelor counts', has: 'Transcripts state English medium', status: 'meets', tag: 'verified', sourceUrl: 'https://www.tu-darmstadt.de' },
    { requirement: 'APS certificate', needs: 'Required for Indian degrees', has: 'Not started', status: 'start_now', tag: 'web', sourceUrl: 'https://aps-india.de' },
    { requirement: 'Application route', needs: 'University portal', has: 'Fill guide ready after APS', status: 'info', tag: 'web', sourceUrl: 'https://www.tu-darmstadt.de' },
  ],
  exams: [
    { name: 'APS', status: 'not_started' },
    { name: 'IELTS', status: 'not_needed' },
    { name: 'GRE', status: 'not_needed' },
  ],
  deadline: { label: 'Winter semester application', date: '2027-01-15', daysLeft: daysUntil('2027-01-15') },
};

export const RWTH_SHORTLIST: ShortlistDTO = {
  id: 'sl-ro-rwth',
  kind: 'programme',
  title: 'MSc Data Science, RWTH Aachen',
  subtitle: 'Aachen · English · winter intake',
  url: 'https://www.rwth-aachen.de',
  status: 'gaps',
  gapCount: 2,
  matrix: RWTH_MATRIX,
  createdAt: new Date().toISOString(),
};

export const ROHAN_OPPORTUNITIES: OpportunitiesBlock['items'] = [
  { id: 'prog-rwth-ds', title: 'MSc Data Science, RWTH Aachen', subtitle: 'Aachen · English · winter intake', url: 'https://www.rwth-aachen.de', kind: 'programme', why: 'Machine learning and statistics core, the two things you named. Grade 2.5 needed, you have 1.9.', shortlisted: false },
  { id: 'prog-tudo-ds', title: 'MSc Data Science, TU Dortmund', subtitle: 'Dortmund · English · winter intake', url: 'https://www.tu-dortmund.de', kind: 'programme', why: 'Strong statistics faculty and low rent.', shortlisted: false },
  { id: 'prog-fau-ai', title: 'MSc Artificial Intelligence, FAU Erlangen-Nürnberg', subtitle: 'Erlangen · English · winter intake', url: 'https://www.fau.eu', kind: 'programme', why: 'Fits your ML internship; smaller city, cheaper than Munich.', shortlisted: false },
];

const trace = (
  tid: string,
  minutesAgo: number,
  kind: TraceDTO['kind'],
  name: string,
  detail: Record<string, unknown>,
  costUsd = 0,
): TraceDTO => ({ id: tid, applicantId: id, runId: 'run-ro-1', kind, name, detail, costUsd, createdAt: ago(minutesAgo * MIN) });

export function rohanState(): ApplicantState {
  return {
    applicant: {
      id,
      name: 'Rohan Mehta',
      email: 'rohan.mehta@example.com',
      subtitle: 'B.Tech CS · Pune',
      homeCity: 'Pune',
      route: 'study',
      routeAlternatives: ['skilled_job', 'chancenkarte'],
      routeReasons: ['B.Tech in computer engineering, CGPA 8.2 (German 1.9)', 'Wants a Master’s in data science', 'English-taught programmes need no German'],
      targetCity: null,
      stage: 'gap_plan',
      stageReason: 'APS not started. Every application waits for it.',
      mode: 'planning',
      staffSecondKey: false,
      submittedAt: null,
      approvedByStaffAt: null,
      cohortChannel: '#masters-ws27',
      createdAt: ago(3 * DAY),
    },
    files: [
      { id: 'f-ro-video', originalName: 'rohan-intro.webm', mime: 'video/webm', size: 22_800_000, kind: 'video', kindLabel: 'Intro video, 1:52', status: 'done', confidence: 1, createdAt: ago(3 * 60 * MIN) },
      { id: 'f-ro-cv', originalName: 'Rohan_Mehta_Resume.pdf', mime: 'application/pdf', size: 140_000, kind: 'cv', kindLabel: 'CV', status: 'done', confidence: 0.98, createdAt: ago(3 * 60 * MIN) },
      { id: 'f-ro-degree', originalName: 'BTech_Degree.pdf', mime: 'application/pdf', size: 620_000, kind: 'degree_certificate', kindLabel: 'B.Tech degree certificate, SPPU', status: 'done', confidence: 0.96, createdAt: ago(3 * 60 * MIN) },
      { id: 'f-ro-marks', originalName: 'Semester_marksheets_1-8.pdf', mime: 'application/pdf', size: 3_400_000, kind: 'transcript', kindLabel: 'Semester transcripts 1 to 8', status: 'done', confidence: 0.94, createdAt: ago(3 * 60 * MIN) },
      { id: 'f-ro-12', originalName: 'HSC_marksheet.pdf', mime: 'application/pdf', size: 410_000, kind: 'marksheet_12', kindLabel: 'Maharashtra HSC class 12 marksheet', status: 'done', confidence: 0.93, createdAt: ago(3 * 60 * MIN) },
      { id: 'f-ro-10', originalName: 'SSC_marksheet.jpg', mime: 'image/jpeg', size: 1_200_000, kind: 'marksheet_10', kindLabel: 'Maharashtra SSC class 10 marksheet', status: 'done', confidence: 0.9, createdAt: ago(3 * 60 * MIN) },
      { id: 'f-ro-passport', originalName: 'Passport.pdf', mime: 'application/pdf', size: 880_000, kind: 'passport', kindLabel: 'Passport', status: 'done', confidence: 0.97, createdAt: ago(3 * 60 * MIN) },
    ],
    transcript: {
      fileId: 'f-ro-video',
      provider: 'groq whisper-large-v3-turbo',
      text: "Hi, I'm Rohan Mehta from Pune. I did my B.Tech in computer science at Pune University, I finished this year with around 8.2 CGPA. I did an internship on ML at a startup for six months, mostly machine learning and statistics. I got 7 in IELTS. I want to do a Master's in data science and then work there. Germany because the universities are strong and the fees are low. In two years I want to be finishing my Master's and working on real ML systems.",
      segments: [
        { start: 0, end: 5, text: "Hi, I'm Rohan Mehta from Pune." },
        { start: 5, end: 18, text: 'I did my B.Tech in computer science at Pune University, I finished this year with around 8.2 CGPA.' },
        { start: 18, end: 31, text: 'I did an internship on ML at a startup for six months, mostly machine learning and statistics.' },
        { start: 31, end: 35, text: 'I got 7 in IELTS.' },
        { start: 35, end: 52, text: "I want to do a Master's in data science and then work there. Germany because the universities are strong and the fees are low." },
        { start: 52, end: 64, text: "In two years I want to be finishing my Master's and working on real ML systems." },
      ],
    },
    facts,
    truth,
    questions: [
      {
        id: 'q-ro-ielts',
        prompt: 'Your CV lists IELTS 7.0, but I can’t see the test report. Can you upload it?',
        why: 'Every programme on your shortlist checks the Test Report Form, not the CV.',
        options: ['Upload report', 'Not taken yet'],
        factKey: 'language.english',
        status: 'open',
        answer: null,
        createdAt: ago(170 * MIN),
      },
      {
        id: 'q-ro-intake',
        prompt: 'Which intake are you aiming for?',
        why: 'Deadlines differ by intake. Your answer sets every countdown.',
        options: ['Winter 2027', 'Summer 2028'],
        factKey: 'goal.intake',
        status: 'open',
        answer: null,
        createdAt: ago(170 * MIN),
      },
    ],
    chat: [
      { id: 'c-ro-1', applicantId: id, author: 'agent', channel: 'web', text: 'Hi Rohan. Your CGPA of 8.2 converts to 1.9 on the German scale, which clears every programme you mentioned. The blocker is APS: start it this week.', createdAt: ago(165 * MIN) },
      { id: 'c-ro-2', applicantId: id, author: 'applicant', channel: 'web', text: 'How long does APS take?', createdAt: ago(60 * MIN) },
      { id: 'c-ro-3', applicantId: id, author: 'agent', channel: 'web', text: 'About 3 to 4 weeks from the day your documents arrive. Book now so it’s done well before the January deadlines.', createdAt: ago(60 * MIN - 15_000) },
    ],
    shortlist: [
      { id: 'sl-ro-tum', kind: 'programme', title: 'MSc Informatics, TU Munich', subtitle: 'Munich · English · winter intake', url: 'https://www.tum.de', status: 'gaps', gapCount: 2, matrix: TUM_MATRIX, createdAt: ago(2 * DAY) },
      { id: 'sl-ro-tuda', kind: 'programme', title: 'MSc Autonomous Systems, TU Darmstadt', subtitle: 'Darmstadt · English · winter intake', url: 'https://www.tu-darmstadt.de', status: 'gaps', gapCount: 1, matrix: TUDA_MATRIX, createdAt: ago(2 * DAY) },
    ],
    gaps: [
      {
        id: 'gap-ro-aps',
        key: 'aps',
        title: 'APS certificate',
        what: 'Book APS document verification. German universities accept Indian degrees only with it.',
        where: 'APS India: online booking, documents by courier',
        howLong: 'About 3 to 4 weeks',
        cost: 'APS fee, paid when you book',
        links: [{ label: 'APS India', url: 'https://aps-india.de' }],
        service: SERVICES.study,
        status: 'open',
        shortlistId: null,
      },
      {
        id: 'gap-ro-ielts',
        key: 'language.english',
        title: 'IELTS Test Report Form',
        what: 'Upload your IELTS report. If you haven’t taken it yet, book IELTS Academic: you need 6.5 overall.',
        where: 'Upload here, or book with IDP or the British Council',
        howLong: 'Upload today, or 2 to 3 weeks to sit the test',
        cost: 'Nothing to upload; the test fee if you still need it',
        links: [{ label: 'IELTS', url: 'https://ielts.org' }],
        service: null,
        status: 'open',
        shortlistId: null,
      },
    ],
    readiness: {
      overall: 58,
      outcome: 'ready_after_plan',
      meters: [
        { label: 'Papers', value: 75 },
        { label: 'Eligibility', value: 100 },
        { label: 'English', value: 50 },
        { label: 'APS', value: 0 },
        { label: 'Money', value: 45 },
      ],
    },
    approvals: [],
    emails: [
      {
        id: 'em-ro-1',
        direction: 'out',
        fromAddr: 'agent@educaro.local',
        toAddr: 'rohan.mehta@example.com',
        subject: 'Three things this week',
        text: '1. Book APS verification.\n2. Upload your IELTS report.\n3. Pick your intake so I can set the countdowns.',
        threadKey: 'digest-ro-1',
        classified: null,
        createdAt: ago(1 * DAY),
      },
    ],
    calendar: [
      { id: 'ev-ro-aps', title: 'Book APS verification', kind: 'task', startsAt: new Date(Date.now() + 2 * DAY).toISOString(), durationMin: 30, location: 'aps-india.de', description: 'Takes about 3 to 4 weeks after your documents arrive.' },
      { id: 'ev-ro-tuda', title: 'TU Darmstadt application deadline', kind: 'deadline', startsAt: '2027-01-15T22:59:00.000Z', durationMin: 0, location: null, description: 'MSc Autonomous Systems, winter semester.' },
    ],
    screen: {
      applicantId: id,
      version: 5,
      mode: 'planning',
      headline: 'Rohan, your 8.2 CGPA is 1.9 on the German scale. Start APS verification this week. Every application waits for it.',
      footnote: 'Munich rent is far above Aachen’s. A budget comparison is one tap away.',
      composedBy: 'agent',
      updatedAt: ago(60 * MIN),
      blocks: [
        {
          id: 'b-ro-next',
          type: 'next_step',
          title: 'Your next step',
          body: 'Book APS document verification. It takes about 3 to 4 weeks.',
          actions: [
            { label: 'Open APS India', kind: 'link', value: 'https://aps-india.de' },
            { label: 'What does APS check?', kind: 'chat', value: 'What does APS check?' },
          ],
          tags: ['web'],
        },
        {
          id: 'b-ro-shortlist',
          type: 'shortlist',
          title: 'Your shortlist',
          items: [
            { id: 'sl-ro-tum', title: 'MSc Informatics, TU Munich', subtitle: 'Munich · English', status: 'gaps', gapCount: 2, url: 'https://www.tum.de' },
            { id: 'sl-ro-tuda', title: 'MSc Autonomous Systems, TU Darmstadt', subtitle: 'Darmstadt · English', status: 'gaps', gapCount: 1, url: 'https://www.tu-darmstadt.de' },
          ],
        },
        {
          id: 'b-ro-q-ielts',
          type: 'question',
          title: 'One question',
          questionId: 'q-ro-ielts',
          prompt: 'Your CV lists IELTS 7.0, but I can’t see the test report. Can you upload it?',
          why: 'Every programme on your shortlist checks the Test Report Form, not the CV.',
          options: ['Upload report', 'Not taken yet'],
        },
        {
          id: 'b-ro-opps',
          type: 'opportunities',
          title: 'Programmes that fit you',
          body: 'Picked from your goal, your grade and your internship. Shortlist one to get its exact requirements.',
          items: ROHAN_OPPORTUNITIES,
        },
        {
          id: 'b-ro-q-intake',
          type: 'question',
          title: 'And one more',
          questionId: 'q-ro-intake',
          prompt: 'Which intake are you aiming for?',
          why: 'Deadlines differ by intake. Your answer sets every countdown.',
          options: ['Winter 2027', 'Summer 2028'],
        },
        {
          id: 'b-ro-grade',
          type: 'note',
          tone: 'info',
          title: 'Your grade on the German scale',
          body: 'Modified Bavarian formula, computed in code: 1 + 3 × (10 − 8.2) ÷ (10 − 4) = 1.9. Best grade 10, pass mark 4 on your university’s scale.',
        },
        {
          id: 'b-ro-budget',
          type: 'budget',
          title: 'A month as a student',
          body: 'Your blocked account covers about this much. Munich costs more mainly because of rent.',
          city: 'Aachen',
          lines: [
            { label: 'Room in a shared flat', amount: 430, note: 'Warm rent, average for students' },
            { label: 'Health insurance', amount: 140, note: 'Public student rate' },
            { label: 'Food', amount: 260 },
            { label: 'Semester fee, per month', amount: 55, note: 'Includes the Deutschlandticket' },
            { label: 'Phone and internet', amount: 25 },
            { label: 'Everything else', amount: 110 },
          ],
          total: 1020,
          compare: [
            { city: 'Darmstadt', total: 1080 },
            { city: 'Munich', total: 1290 },
          ],
          sources: [
            { label: 'DAAD: cost of living', url: 'https://www.daad.de' },
            { label: 'Federal Foreign Office: blocked account', url: 'https://www.auswaertiges-amt.de' },
          ],
        },
        {
          id: 'b-ro-readiness',
          type: 'readiness',
          title: 'How ready you are',
          overall: 58,
          outcome: 'ready_after_plan',
          meters: [
            { label: 'Papers', value: 75 },
            { label: 'Eligibility', value: 100 },
            { label: 'English', value: 50 },
            { label: 'APS', value: 0 },
            { label: 'Money', value: 45 },
          ],
        },
        {
          id: 'b-ro-services',
          type: 'services',
          title: 'Educaro can do this with you',
          services: [
            { ...SERVICES.study, why: 'APS file, uni-assist pack and your motivation letter.' },
            { ...SERVICES.german, why: 'A1 for daily life. Your course is in English.' },
            { ...SERVICES.consultant, why: 'Thirty minutes on your shortlist.' },
          ],
        },
        { id: 'b-ro-truth', type: 'truth_map', title: 'What you said, wrote and proved', rows: truth },
      ],
    },
    trace: [
      trace('t-ro-01', 182, 'event', 'upload', { files: 6, video: 'rohan-intro.webm' }),
      trace('t-ro-02', 181, 'tool', 'transcribe_media', { file: 'rohan-intro.webm', provider: 'groq whisper-large-v3-turbo', seconds: 64 }),
      trace('t-ro-03', 180, 'tool', 'extract_document', { file: 'Semester_marksheets_1-8.pdf', cgpa: 8.21, by: 'rules' }),
      trace('t-ro-04', 179, 'tool', 'convert_grade', { formula: 'modified Bavarian', input: 8.21, best: 10, pass: 4, result: 1.9, by: 'code' }),
      trace('t-ro-05', 178, 'guard', 'no_source_no_save', { rejected: 'IELTS 7.0 as Verified', reason: 'No Test Report Form uploaded. Saved as You said.' }),
      trace('t-ro-06', 176, 'plan', 'supervisor', { moves: ['ask', 'run_specialists', 'rewrite_screen'], skill: 'route-study-india', why: 'APS missing blocks every application.' }, 0.0027),
      trace('t-ro-07', 175, 'tool', 'run_specialist', { specialist: 'university_scout' }),
      trace('t-ro-08', 175, 'source', 'web_fetch', { url: 'https://aps-india.de', status: 200, quote: 'All Indian students who want to study in Germany need an APS certificate.' }),
      trace('t-ro-09', 174, 'tool', 'run_specialist', { specialist: 'money' }),
      trace('t-ro-10', 174, 'source', 'web_fetch', { url: 'https://www.daad.de', status: 200 }),
      trace('t-ro-11', 172, 'llm', 'compose_screen', { tier: 'quality', model: 'gpt-5-mini', blocks: 10, cached: false }, 0.0039),
      trace('t-ro-12', 171, 'move', 'stage', { from: 'profiling', to: 'gap_plan', reason: 'APS not started. Every application waits for it.' }),
    ],
  };
}
