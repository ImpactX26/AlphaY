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
        // The admission-services scam, which is the one that hits Master's applicants: a real
        // process (uni-assist, APS) with a fake middleman charging for a free step.
        {
          id: 'b-ro-scam',
          type: 'scam_check',
          title: 'The "admission guarantee" email you got',
          body: 'You asked whether to pay EduGateway Consultancy ₹85,000 for guaranteed RWTH admission. No. Here is why, and what is actually free.',
          subject: { kind: 'agent', name: 'EduGateway Consultancy' },
          verdict: 'high_risk',
          score: 12,
          signals: [
            { label: 'Guarantees admission', status: 'bad', detail: 'No agent can guarantee a place at a German public university. Admission is decided by the university on your documents alone — nobody can sell influence over it.' },
            { label: 'Charges ₹85,000 for uni-assist and APS', status: 'bad', detail: 'uni-assist costs €75 for the first application and €30 after. APS costs ₹18,000, paid to APS India directly. You are being charged roughly 5x for steps you can do yourself.' },
            { label: 'Claims to be an "official RWTH partner"', status: 'bad', detail: 'RWTH Aachen lists no admission agents. I checked their international office page — applications go through uni-assist only.' },
            { label: 'Asks for your APS login and passport scan', status: 'bad', detail: 'Handing over your APS credentials lets someone else alter your academic file. That can get your application rejected for fraud, and the rejection follows you.' },
            { label: 'No GST number or registered address', status: 'bad', detail: 'An Indian consultancy taking ₹85,000 must issue a GST invoice. There is none, so you would have no recourse at all.' },
            { label: 'The deadline pressure is manufactured', status: 'warn', detail: '"Only 3 seats left, pay by Friday." RWTH’s winter deadline is 1 March and there are no seats to reserve. Urgency is the whole technique.' },
          ],
          contractFlags: [
            {
              clause: 'Service fee of ₹85,000 is non-refundable regardless of admission outcome.',
              why: 'You pay the same whether you get in or not, which means the "guarantee" guarantees nothing.',
              lawSays: 'A guarantee that carries no consequence for failure is not a guarantee. Under the Consumer Protection Act 2019 this is a deficiency in service and a misleading advertisement.',
              severity: 'unfair',
            },
            {
              clause: 'The client authorises EduGateway to communicate with universities on the client’s behalf using the client’s credentials.',
              why: 'Anything they write becomes something you said. If they overstate your marks, it is your application that is fraudulent.',
              lawSays: 'APS and uni-assist require the applicant’s own declaration. Credential sharing breaches their terms and is grounds for rejecting the file.',
              severity: 'illegal',
            },
            {
              clause: 'Client agrees not to apply to any university independently during the service period.',
              why: 'It stops you doing the free thing that works, so you cannot discover you did not need them.',
              lawSays: 'An unenforceable restraint. You may apply to any university at any time, and no agreement can remove that.',
              severity: 'illegal',
            },
          ],
          neverDo: [
            'Pay anyone for "guaranteed" admission to a German public university.',
            'Share your APS or uni-assist login with an agent, ever.',
            'Send a passport scan to a consultancy that has not issued you a GST invoice.',
            'Let a deadline you cannot verify on the university’s own site rush you into paying.',
          ],
        },
        // Money over time. The blocked account is nine months out and is the whole decision.
        {
          id: 'b-ro-finance',
          type: 'finance_plan',
          title: 'What this costs, and when',
          body: 'Public universities charge no tuition, so almost all of this is the blocked account — and you get that money back month by month once you arrive.',
          currency: 'EUR',
          inrPerEur: 92,
          oneOff: [
            { label: 'APS certificate', amountEur: 196, whenMonth: 'Nov 2026', paid: false, note: 'Paid to APS India. Not started yet — this is the long pole.' },
            { label: 'IELTS test fee', amountEur: 185, whenMonth: 'Nov 2026', paid: false, note: 'You said 7.0 but there is no report on file, so budget for sitting it.' },
            { label: 'uni-assist, three applications', amountEur: 135, whenMonth: 'Jan 2027', paid: false, note: '€75 for the first, €30 each after.' },
            { label: 'Certified translations of transcripts', amountEur: 120, whenMonth: 'Jan 2027', paid: false },
            { label: 'Blocked account (Sperrkonto)', amountEur: 12324, whenMonth: 'Jun 2027', paid: false, note: 'Released to you as about €1,027 a month. Proof of funds, not a fee.' },
            { label: 'Visa fee and biometrics', amountEur: 75, whenMonth: 'Jul 2027', paid: false },
            { label: 'Flight, Pune to Düsseldorf', amountEur: 480, whenMonth: 'Sep 2027', paid: false },
            { label: 'Semester contribution, first semester', amountEur: 330, whenMonth: 'Oct 2027', paid: false, note: 'Includes the Deutschlandticket for all of NRW.' },
          ],
          monthlyEur: 1020,
          needBeforeTravelEur: 13845,
          haveEur: 6200,
          fundingGapEur: 7645,
          options: [
            { label: 'Education loan against the admission letter', detail: 'Indian banks lend ₹15–25 lakh against a German admission letter at 9–11%, no collateral up to ₹7.5 lakh. The letter is what unlocks it, so this is a February conversation, not a now one.' },
            { label: 'Working 20 hours a week as a student', detail: 'Legal on a student visa: about €550–700 a month in Aachen. It cannot fund the blocked account, but it covers your living costs from semester two.' },
            { label: 'DAAD and Deutschlandstipendium', detail: 'Deutschlandstipendium is €300 a month and RWTH awards it on grades — your 1.9 is competitive. Applications open with enrolment.' },
            { label: 'A HiWi or research assistant post', detail: 'Common in CS at RWTH from the second semester, €13–15 an hour, and it counts as relevant experience rather than just income.' },
          ],
        },
        // What a Master's in Germany is actually like for an Indian student, including the bits
        // the agency brochures leave out.
        {
          id: 'b-ro-reality',
          type: 'reality_check',
          title: 'What a German Master’s is actually like',
          body: 'Free tuition is real. "Easy" is not. Worth knowing before the blocked account rather than after.',
          route: 'Master’s, Data Science',
          headline: 'No tuition, a world-class degree and a real path to staying. But exams are the whole grade, nobody chases you, and failing twice can end the degree.',
          shifts: [
            { label: 'One exam is often 100% of the module', detail: 'No internal marks, no assignments to carry you. German universities examine once, at the end, and that is the grade.' },
            { label: 'Two or three attempts, then you are out', detail: 'Fail a compulsory module three times at most German universities and you are barred from that degree nationwide. This is the rule Indian students most often learn too late.' },
            { label: 'Nobody takes attendance', detail: 'Lectures are optional and no one notices you are gone. The students who struggle are usually the ones who enjoyed that in semester one.' },
            { label: 'Four semesters means six in practice', detail: 'Most international students take 5–6 semesters including the thesis. It is normal and it is not failure — but it is four more months of rent than you planned.' },
            { label: 'Your Master’s thesis is six months of real work', detail: 'Often at a company — Fraunhofer, Bosch, a startup — and frequently the thing that turns into your first job.' },
          ],
          money: [
            { label: '€0 tuition, €330 a semester', detail: 'The contribution includes a transport ticket for the whole of NRW, which is worth more than it costs.' },
            { label: '€1,020 a month to live in Aachen', detail: 'Munich is about €1,290, mostly rent. Aachen is one of the reasons RWTH is a good financial choice.' },
            { label: '€550–700 from a 20-hour student job', detail: 'Enough for living costs, never enough for the blocked account. Plan the funding without it.' },
            { label: '18-month post-study job-seeker visa', detail: 'And CS graduates from RWTH are hired. This is the part that actually pays the plan back.' },
          ],
          hard: [
            { stat: '1.9', detail: 'Your German grade — competitive for all three on your shortlist' },
            { stat: '5.5 semesters', detail: 'Median actual completion for international Master’s students' },
            { stat: '4 months', detail: 'APS takes this long, and no application moves without it' },
          ],
          voices: [
            { who: 'B.Tech CS, Pune → RWTH, 2024', quote: 'The first exam period broke me. I had never been examined on a whole semester at once with nothing else counting. Second semester I planned backwards from the exam dates and it was fine.' },
            { who: 'B.Tech IT, Hyderabad → TU Darmstadt, 2023', quote: 'Start APS the week you decide. Mine took five months and I missed a winter intake over paperwork, not grades.' },
            { who: 'B.Tech CS, Chennai → TUM, 2022', quote: 'Free tuition is real and the degree opens doors. But you are on your own in a way Indian colleges never leave you — that is the actual adjustment.' },
          ],
          source: 'Eleven Educaro students on this route, plus DAAD and RWTH examination regulations, 2026',
        },
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
