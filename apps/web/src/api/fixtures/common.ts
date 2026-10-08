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
  Block,
  Screen,
  ScreenSection,
  SectionId,
  ServiceRef,
  ShortlistDTO,
  TraceDTO,
  TranscriptDTO,
  TruthRow,
} from '@educaro/shared';
import { SECTION_LABEL } from '@educaro/shared';

/** Example data only. Mock mode never calls a model or the network. */

/**
 * Which section each block belongs to — the same table as `sectionFor` in the composer.
 *
 * It is duplicated rather than imported because the web cannot import from `apps/api`, and mock
 * mode has to agree with the real thing: if the nav is data-driven and the mock sends no sections,
 * the demo's offline path loses Money, Safety and Community — the exact features this was built to
 * stop hiding. If A's table changes, this one has to follow.
 */
const SECTION_OF: Record<Block['type'], SectionId> = {
  next_step: 'home',
  question: 'home',
  readiness: 'home',
  note: 'home',
  route: 'plan',
  gap_plan: 'plan',
  checklist: 'plan',
  timeline: 'plan',
  opportunities: 'plan',
  shortlist: 'plan',
  requirement_matrix: 'plan',
  reality_check: 'plan',
  documents: 'papers',
  truth_map: 'papers',
  budget: 'money',
  finance_plan: 'money',
  places: 'life',
  rentals: 'life',
  arrival: 'life',
  services: 'life',
  scam_check: 'safety',
  help: 'safety',
  community: 'community',
  cohort: 'community',
  cohort_group: 'community',
  letters: 'inbox',
};

const SECTION_ORDER: SectionId[] = ['home', 'plan', 'papers', 'money', 'life', 'safety', 'community', 'inbox'];

/** Tag every block with its section and list the sections that have something in them. */
export function withSections(screen: Screen): Screen {
  const blocks = screen.blocks.map((b) => ({ ...b, section: b.section ?? SECTION_OF[b.type] ?? 'home' }));
  const sections: ScreenSection[] = SECTION_ORDER.map((id) => {
    const mine = blocks.filter((b) => (b.section ?? 'home') === id);
    return {
      id,
      label: SECTION_LABEL[id],
      blockIds: mine.map((b) => b.id),
      // Only what is genuinely waiting on them, so a dot always means "do something".
      needsAttention: mine.some(
        (b) =>
          b.type === 'question' ||
          (b.type === 'scam_check' && b.verdict === 'high_risk') ||
          (b.type === 'letters' && b.drafts.some((d) => d.status === 'pending')),
      ),
    };
  }).filter((s) => s.blockIds.length > 0);
  return { ...screen, blocks, sections };
}

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
