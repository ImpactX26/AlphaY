import type {
  BatchPlanDTO,
  BroadcastDTO,
  CopilotResultDTO,
  MatchDTO,
  OpeningDTO,
  PipelineCardDTO,
} from '@educaro/shared';
import { ANANYA_ID } from './ananya';
import { ago, DAY, HOUR, MIN } from './common';

/** Other applicants on the board. Ananya and Rohan are computed live from their state. */
export const OTHER_CARDS: PipelineCardDTO[] = [
  { applicantId: 'app-anjali', name: 'Anjali Das', subtitle: 'BSc Nursing · Kolkata', route: null, stage: 'new_story', stageReason: 'Signed up today. Waiting for her video.', readiness: 5, openGaps: 0, openQuestions: 0, pendingApprovals: 0, conflicts: 0, updatedAt: ago(25 * MIN) },
  { applicantId: 'app-rahul', name: 'Rahul Verma', subtitle: 'B.Tech Mechanical · Indore', route: 'study', stage: 'new_story', stageReason: 'Video in. No documents yet.', readiness: 12, openGaps: 0, openQuestions: 1, pendingApprovals: 0, conflicts: 0, updatedAt: ago(2 * HOUR) },
  { applicantId: 'app-arjun', name: 'Arjun Reddy', subtitle: 'Diploma Mechanical · Hyderabad', route: 'ausbildung', stage: 'profiling', stageReason: 'Reading 4 of 9 files. One scan unclear.', readiness: 30, openGaps: 1, openQuestions: 1, pendingApprovals: 0, conflicts: 0, updatedAt: ago(8 * MIN) },
  { applicantId: 'app-vikram', name: 'Vikram Singh', subtitle: 'B.E. Electrical · Jaipur', route: 'chancenkarte', stage: 'profiling', stageReason: 'Chancenkarte at 5 of 6 points. Checking English C1.', readiness: 34, openGaps: 2, openQuestions: 2, pendingApprovals: 0, conflicts: 1, updatedAt: ago(40 * MIN) },
  { applicantId: 'app-karthik', name: 'Karthik Iyer', subtitle: 'B.Com · Chennai', route: 'ausbildung', stage: 'gap_plan', stageReason: 'Needs B1 for Ausbildung as Kaufmann im Einzelhandel. Plan shown.', readiness: 48, openGaps: 2, openQuestions: 0, pendingApprovals: 0, conflicts: 0, updatedAt: ago(3 * HOUR) },
  { applicantId: 'app-meera', name: 'Meera Thomas', subtitle: 'BSc Nursing · Thrissur', route: 'nursing', stage: 'ready', stageReason: 'B2 certificate verified. Recognition filed through educaro Akademie.', readiness: 92, openGaps: 0, openQuestions: 0, pendingApprovals: 0, conflicts: 0, updatedAt: ago(5 * HOUR) },
  { applicantId: 'app-priya', name: 'Priya Menon', subtitle: 'MSc Biotechnology · Bengaluru', route: 'skilled_job', stage: 'ready', stageReason: 'Degree recognised (anabin H+). Ready for matching.', readiness: 86, openGaps: 0, openQuestions: 0, pendingApprovals: 0, conflicts: 0, updatedAt: ago(1 * DAY) },
  { applicantId: 'app-fatima', name: 'Fatima Shaikh', subtitle: 'BSc Nursing · Mumbai', route: 'nursing', stage: 'matched', stageReason: 'Matched to Seniorenresidenz Lindenhof, Aachen. Profile sent.', readiness: 88, openGaps: 0, openQuestions: 0, pendingApprovals: 1, conflicts: 0, updatedAt: ago(6 * HOUR) },
  { applicantId: 'app-sameer', name: 'Sameer Khan', subtitle: 'Diploma Electrician · Lucknow', route: 'ausbildung', stage: 'matched', stageReason: 'Matched to Elektroniker Ausbildung, Stadtwerke Neckartal.', readiness: 81, openGaps: 1, openQuestions: 0, pendingApprovals: 0, conflicts: 0, updatedAt: ago(9 * HOUR) },
  { applicantId: 'app-sneha', name: 'Sneha Kulkarni', subtitle: 'GNM nurse · Kolhapur', route: 'nursing', stage: 'applied', stageReason: 'Bewerbung sent to Haus am Rhein, Bonn. Waiting for a reply.', readiness: 88, openGaps: 0, openQuestions: 0, pendingApprovals: 0, conflicts: 0, updatedAt: ago(2 * DAY) },
  { applicantId: 'app-joseph', name: 'Joseph Mathew', subtitle: 'BSc Nursing · Kottayam', route: 'nursing', stage: 'visa', stageReason: 'Visa appointment at VFS Bengaluru on 21 Oct.', readiness: 95, openGaps: 0, openQuestions: 0, pendingApprovals: 0, conflicts: 0, updatedAt: ago(1 * DAY) },
  { applicantId: 'app-divya', name: 'Divya Pillai', subtitle: 'GNM nurse · Kollam', route: 'nursing', stage: 'arrived', stageReason: 'Arrived in Bonn on 2 Oct. Anmeldung booked for 14 Oct.', readiness: 100, openGaps: 0, openQuestions: 0, pendingApprovals: 0, conflicts: 0, updatedAt: ago(3 * DAY) },
];

export const OPENINGS: OpeningDTO[] = [
  {
    id: 'open-rheinpflege',
    employer: 'Rheinpflege Seniorenzentrum',
    employerEmail: 'bewerbung@rheinpflege.example',
    title: 'Pflegefachkraft (m/w/d) with Anerkennung',
    city: 'Cologne',
    route: 'nursing',
    germanLevel: 'B2',
    startDate: '2027-09-01',
    needsRecognition: true,
    description:
      'Elderly care home in Cologne-Ehrenfeld, 120 residents, a dedicated dementia unit. We fund the adaptation course for the Anerkennung and support the move. B2 German by the start date.',
    keywords: ['elderly care', 'geriatric', 'dementia', 'Anerkennung', 'adaptation course', 'B2'],
    status: 'open',
    createdAt: ago(4 * DAY),
  },
  {
    id: 'open-lindenhof',
    employer: 'Seniorenresidenz Lindenhof',
    employerEmail: 'personal@lindenhof.example',
    title: 'Pflegehelferin (m/w/d) during Anerkennung',
    city: 'Aachen',
    route: 'nursing',
    germanLevel: 'B1',
    startDate: '2027-06-01',
    needsRecognition: true,
    description: 'Work as a nursing assistant while your recognition finishes, then move up to Pflegefachkraft.',
    keywords: ['nursing assistant', 'Anerkennung', 'B1', 'shift work'],
    status: 'open',
    createdAt: ago(9 * DAY),
  },
  {
    id: 'open-neckartal',
    employer: 'Stadtwerke Neckartal',
    employerEmail: 'ausbildung@neckartal.example',
    title: 'Ausbildung Elektroniker/in für Energie- und Gebäudetechnik',
    city: 'Stuttgart',
    route: 'ausbildung',
    germanLevel: 'B1',
    startDate: '2027-08-01',
    needsRecognition: false,
    description: 'Three-year Ausbildung with a monthly training allowance. Class 12 with maths and physics.',
    keywords: ['Ausbildung', 'electrical', 'maths', 'B1'],
    status: 'open',
    createdAt: ago(12 * DAY),
  },
];

export function rankedMatches(openingId: string): MatchDTO[] {
  if (openingId === 'open-rheinpflege') {
    return [
      {
        id: 'm-rp-ananya',
        openingId,
        applicantId: ANANYA_ID,
        displayName: 'Candidate A',
        score: 0.91,
        reasons: [
          'GNM diploma verified; three years on a geriatric ward (experience letter, Jul 2021 to Aug 2024).',
          'Sister in Cologne. A2 said, B1 course booked; B2 planned before Sep 2027.',
        ],
        consent: false,
        status: 'ranked',
        germanProfile: null,
      },
      {
        id: 'm-rp-meera',
        openingId,
        applicantId: 'app-meera',
        displayName: 'Candidate B',
        score: 0.86,
        reasons: ['BSc Nursing verified; B2 certificate verified (ÖSD).', 'Recognition already filed. Prefers NRW, can start Jun 2027.'],
        consent: true,
        status: 'ranked',
        germanProfile: null,
      },
      {
        id: 'm-rp-sneha',
        openingId,
        applicantId: 'app-sneha',
        displayName: 'Candidate C',
        score: 0.74,
        reasons: ['GNM diploma verified; two years in a care home.', 'B1 verified. Already applied to Haus am Rhein, Bonn.'],
        consent: false,
        status: 'ranked',
        germanProfile: null,
      },
    ];
  }
  if (openingId === 'open-lindenhof') {
    return [
      { id: 'm-lh-fatima', openingId, applicantId: 'app-fatima', displayName: 'Fatima Shaikh', score: 0.88, reasons: ['BSc Nursing verified; B1 verified.', 'Wants Aachen; profile already sent.'], consent: true, status: 'sent', germanProfile: null },
      { id: 'm-lh-ananya', openingId, applicantId: ANANYA_ID, displayName: 'Candidate B', score: 0.8, reasons: ['GNM diploma verified; geriatric ward experience.', 'B1 planned for Feb 2027, in time for a June start.'], consent: false, status: 'ranked', germanProfile: null },
    ];
  }
  return [
    { id: `m-${openingId}-sameer`, openingId, applicantId: 'app-sameer', displayName: 'Sameer Khan', score: 0.84, reasons: ['Electrician diploma verified; class 12 maths and physics.', 'B1 exam booked for Nov 2026.'], consent: true, status: 'sent', germanProfile: null },
    { id: `m-${openingId}-arjun`, openingId, applicantId: 'app-arjun', displayName: 'Candidate B', score: 0.69, reasons: ['Mechanical diploma; electrical modules in year 2.', 'A2 today; B1 needs about 4 months.'], consent: false, status: 'ranked', germanProfile: null },
  ];
}

export function germanProfile(match: MatchDTO): NonNullable<MatchDTO['germanProfile']> {
  if (match.applicantId === ANANYA_ID) {
    return {
      headline: 'Pflegefachkraft (GNM, Indien) · 3 Jahre Geriatrie · Deutsch B1 ab 02/2027',
      sections: [
        { title: 'Qualifikation', lines: ['GNM-Diplom (General Nursing and Midwifery), 2021, verifiziert', 'Anerkennung: Antrag über educaro Akademie geplant'] },
        { title: 'Berufserfahrung', lines: ['07/2021 bis 08/2024: Staff Nurse, Klinik in Kochi, überwiegend Geriatrie'] },
        { title: 'Sprachen', lines: ['Deutsch: A2 (Selbstauskunft), ÖSD B1 geplant 02/2027, B2 vor Arbeitsbeginn', 'Englisch: fließend'] },
        { title: 'Verfügbarkeit', lines: ['Start ab 09/2027', 'Familie in Köln'] },
      ],
    };
  }
  return {
    headline: 'Pflegefachkraft (Indien) · Deutsch B2 · Anerkennung beantragt',
    sections: [
      { title: 'Qualifikation', lines: ['BSc Nursing, verifiziert', 'Anerkennung beantragt'] },
      { title: 'Sprachen', lines: ['Deutsch B2 (ÖSD), verifiziert', 'Englisch: fließend'] },
      { title: 'Verfügbarkeit', lines: ['Start ab 06/2027'] },
    ],
  };
}

export const BATCH_PLAN: BatchPlanDTO = {
  months: [
    { month: '2026-11', A2: 14, B1: 9, B2: 4 },
    { month: '2026-12', A2: 11, B1: 12, B2: 5 },
    { month: '2027-01', A2: 9, B1: 15, B2: 7 },
    { month: '2027-02', A2: 8, B1: 18, B2: 9 },
    { month: '2027-03', A2: 6, B1: 13, B2: 12 },
    { month: '2027-04', A2: 5, B1: 10, B2: 14 },
    { month: '2027-05', A2: 4, B1: 8, B2: 16 },
    { month: '2027-06', A2: 3, B1: 6, B2: 11 },
  ],
  totals: { A2: 60, B1: 91, B2: 78 },
};

export const BROADCASTS: BroadcastDTO[] = [
  {
    id: 'bc-osd-dates',
    topic: 'ÖSD exam dates for spring 2027 are published',
    status: 'sent',
    createdAt: ago(3 * DAY),
    messages: [
      { applicantId: ANANYA_ID, name: 'Ananya Nair', text: 'Ananya, the ÖSD B1 exam at Educaro is on 15 February. That fits your B1 batch, which ends late January. Want me to hold a seat?' },
      { applicantId: 'app-karthik', name: 'Karthik Iyer', text: 'Karthik, B1 exams at Educaro run on 15 February and 22 March. With your course pace, 22 March is the safer pick.' },
      { applicantId: 'app-vikram', name: 'Vikram Singh', text: 'Vikram, an A2 certificate adds a Chancenkarte point. The next ÖSD A2 date is 8 February.' },
    ],
  },
];

export function copilotAnswer(query: string): CopilotResultDTO {
  const q = query.toLowerCase();
  if (q.includes('nurse') || q.includes('b1')) {
    return {
      query,
      interpretation: 'Route is nursing, German B1 or higher (verified or planned before the start), can start by September 2027.',
      columns: ['Name', 'City', 'German', 'Recognition', 'Can start'],
      rows: [
        { Name: 'Meera Thomas', City: 'Thrissur', German: 'B2, verified', Recognition: 'Filed', 'Can start': 'Jun 2027' },
        { Name: 'Fatima Shaikh', City: 'Mumbai', German: 'B1, verified', Recognition: 'Filed', 'Can start': 'Jun 2027' },
        { Name: 'Sneha Kulkarni', City: 'Kolhapur', German: 'B1, verified', Recognition: 'Not started', 'Can start': 'Aug 2027' },
        { Name: 'Ananya Nair', City: 'Kochi', German: 'A2 said, B1 planned Feb 2027', Recognition: 'Planned', 'Can start': 'Sep 2027' },
      ],
      applicantIds: ['app-meera', 'app-fatima', 'app-sneha', ANANYA_ID],
    };
  }
  if (q.includes('deadline')) {
    return {
      query,
      interpretation: 'Calendar items of kind deadline or exam in the next 14 days, across all applicants.',
      columns: ['Name', 'What', 'Date', 'Days left'],
      rows: [
        { Name: 'Rohan Mehta', What: 'Book APS verification', Date: '10 Oct 2026', 'Days left': 2 },
        { Name: 'Karthik Iyer', What: 'ÖSD A2 registration closes', Date: '14 Oct 2026', 'Days left': 6 },
        { Name: 'Joseph Mathew', What: 'Visa appointment, VFS Bengaluru', Date: '21 Oct 2026', 'Days left': 13 },
      ],
      applicantIds: ['app-rohan', 'app-karthik', 'app-joseph'],
    };
  }
  if (q.includes('conflict')) {
    return {
      query,
      interpretation: 'Truth-map rows with status Conflict that no staff member has opened yet.',
      columns: ['Name', 'Fact', 'CV says', 'Document says', 'Open for'],
      rows: [
        { Name: 'Ananya Nair', Fact: 'Experience, Aster Medcity', 'CV says': '2021 to 2023', 'Document says': 'Jul 2021 to Aug 2024', 'Open for': '52 min' },
        { Name: 'Ananya Nair', Fact: 'Name', 'CV says': 'Ananya Nair', 'Document says': 'Diploma: ANANYA P.', 'Open for': '52 min' },
        { Name: 'Vikram Singh', Fact: 'Graduation year', 'CV says': '2019', 'Document says': '2020', 'Open for': '3 h' },
      ],
      applicantIds: [ANANYA_ID, ANANYA_ID, 'app-vikram'],
    };
  }
  return {
    query,
    interpretation: `Applicants whose profile mentions “${query}”. Showing everyone with a recent update.`,
    columns: ['Name', 'Route', 'Stage', 'Readiness'],
    rows: [
      { Name: 'Ananya Nair', Route: 'Nursing', Stage: 'Gap plan', Readiness: 70 },
      { Name: 'Rohan Mehta', Route: 'Study', Stage: 'Gap plan', Readiness: 58 },
      { Name: 'Arjun Reddy', Route: 'Ausbildung', Stage: 'Profiling', Readiness: 30 },
    ],
    applicantIds: [ANANYA_ID, 'app-rohan', 'app-arjun'],
  };
}
