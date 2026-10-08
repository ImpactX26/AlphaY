import type {
  ApplicantDTO,
  ApprovalDetailDTO,
  CalendarEventDTO,
  ChatMessageDTO,
  EmailDTO,
  FactDTO,
  FileDTO,
  GapDTO,
  QuestionDTO,
  ReadinessDTO,
  Screen,
  ServiceRef,
  ShortlistDTO,
  TraceDTO,
  TranscriptDTO,
  TruthRow,
} from '@educaro/shared';

/** Example data only. Mock mode never calls a model or the network. */

export const NOW = Date.now();
export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const ago = (ms: number): string => new Date(NOW - ms).toISOString();
export const ahead = (ms: number): string => new Date(NOW + ms).toISOString();
export const daysUntil = (isoDate: string): number => Math.ceil((Date.parse(isoDate) - Date.now()) / DAY);

export interface ApplicantState {
  applicant: ApplicantDTO;
  files: FileDTO[];
  transcript: TranscriptDTO | null;
  facts: FactDTO[];
  truth: TruthRow[];
  questions: QuestionDTO[];
  chat: ChatMessageDTO[];
  shortlist: ShortlistDTO[];
  gaps: GapDTO[];
  readiness: ReadinessDTO;
  approvals: ApprovalDetailDTO[];
  emails: EmailDTO[];
  calendar: CalendarEventDTO[];
  screen: Screen;
  trace: TraceDTO[];
}

export const SERVICES = {
  nursing: { id: 'svc-nursing', name: 'Educaro Nursing Program', url: 'https://www.educaro.de/india/' },
  ausbildung: { id: 'svc-ausbildung', name: 'Ausbildung program', url: 'https://www.educaro.de/india/' },
  study: { id: 'svc-study', name: 'Study guidance', url: 'https://www.educaro.de/india/' },
  skilled: { id: 'svc-skilled', name: 'Skilled worker placement', url: 'https://www.educaro.de/fachkrafte/' },
  german: { id: 'svc-german', name: 'German course A1 to B2', url: 'https://www.educaro.de/sprachkurse/' },
  osd: { id: 'svc-osd', name: 'ÖSD exam at Educaro', url: 'https://www.educaro.de/sprachkurse/' },
  anerkennung: { id: 'svc-anerkennung', name: 'Anerkennung via educaro Akademie', url: 'https://www.educaro.de/anerkennung/' },
  consultant: { id: 'svc-consultant', name: 'Consultant call', url: 'https://www.educaro.de/india/' },
} satisfies Record<string, ServiceRef>;

export function emptyScreen(applicantId: string, name: string): Screen {
  const first = name.split(' ')[0] || 'there';
  return {
    applicantId,
    version: 1,
    mode: 'onboarding',
    headline: `Hi ${first}. Tell me your story once, and I'll build your plan for Germany.`,
    footnote: 'Your files stay on Educaro’s server. Nothing personal goes into web searches.',
    blocks: [],
    composedBy: 'rules',
    updatedAt: new Date().toISOString(),
  };
}

export function freshState(applicantId: string, name: string, email: string | null): ApplicantState {
  return {
    applicant: {
      id: applicantId,
      name,
      email,
      subtitle: null,
      homeCity: null,
      route: null,
      routeAlternatives: [],
      routeReasons: [],
      targetCity: null,
      stage: 'new_story',
      stageReason: 'Signed up. Waiting for a video and documents.',
      mode: 'onboarding',
      staffSecondKey: false,
      submittedAt: null,
      approvedByStaffAt: null,
      cohortChannel: null,
      createdAt: new Date().toISOString(),
    },
    files: [],
    transcript: null,
    facts: [],
    truth: [],
    questions: [],
    chat: [
      {
        id: `c-${applicantId}-hello`,
        applicantId,
        author: 'agent',
        channel: 'web',
        text: 'Hi! Record a short video about yourself and drop every document you have, in any order. I’ll read them and ask only what I can’t find.',
        createdAt: new Date().toISOString(),
      },
    ],
    shortlist: [],
    gaps: [],
    readiness: { overall: 0, outcome: 'ready_after_plan', meters: [] },
    approvals: [],
    emails: [],
    calendar: [],
    screen: emptyScreen(applicantId, name),
    trace: [],
  };
}

/** Guess a document kind from its file name, the way the mock "classifier" sorts uploads. */
export function guessKind(name: string, mime: string): { kind: string; label: string; confidence: number } {
  const n = name.toLowerCase();
  const rules: [RegExp, string, string][] = [
    [/(cv|resume|lebenslauf)/, 'cv', 'CV'],
    [/passport/, 'passport', 'Passport'],
    [/(experience|relieving|employment)/, 'experience_letter', 'Experience letter'],
    [/(payslip|salary)/, 'payslip', 'Payslip'],
    [/(ielts|toefl|goethe|osd|ösd|telc|testdaf|german|deutsch)/, 'language_certificate', 'Language certificate'],
    [/(aps)/, 'aps_certificate', 'APS certificate'],
    [/(council|registration|knmc|inc)/, 'registration_certificate', 'Nursing council registration'],
    [/(12th|hsc|class.?12|plus.?two|xii)/, 'marksheet_12', 'Class 12 marksheet'],
    [/(10th|ssc|sslc|class.?10|\bx\b)/, 'marksheet_10', 'Class 10 marksheet'],
    [/(transcript|semester|marks)/, 'transcript', 'Semester transcript'],
    [/(diploma|gnm|anm)/, 'diploma_certificate', 'Diploma certificate'],
    [/(degree|b\.?tech|bachelor|master|convocation)/, 'degree_certificate', 'Degree certificate'],
  ];
  for (const [re, kind, label] of rules) if (re.test(n)) return { kind, label, confidence: 0.86 + Math.random() * 0.12 };
  if (mime.startsWith('image/')) return { kind: 'other', label: 'Unclear photo', confidence: 0.41 };
  return { kind: 'other', label: 'Other document', confidence: 0.62 };
}
