/** React Query keys. Applicant-scoped data lives under ['applicant', id, section]. */
export type ApplicantSection =
  | 'profile'
  | 'screen'
  | 'files'
  | 'transcript'
  | 'facts'
  | 'truth_map'
  | 'questions'
  | 'chat'
  | 'shortlist'
  | 'gaps'
  | 'readiness'
  | 'approvals'
  | 'emails'
  | 'calendar'
  | 'trace'
  | 'brief';

export const qk = {
  me: ['me'] as const,
  systemStatus: ['system', 'status'] as const,
  applicantAll: (id: string) => ['applicant', id] as const,
  applicant: (id: string, section: ApplicantSection) => ['applicant', id, section] as const,
  approval: (approvalId: string) => ['approval', approvalId] as const,
  interview: (sessionId: string) => ['interview', sessionId] as const,
  staff: {
    all: ['staff'] as const,
    pipeline: ['staff', 'pipeline'] as const,
    queue: ['staff', 'queue'] as const,
    openings: ['staff', 'openings'] as const,
    matches: (openingId: string) => ['staff', 'matches', openingId] as const,
    batch: ['staff', 'batch'] as const,
    broadcasts: ['staff', 'broadcasts'] as const,
    trace: (applicantId?: string) => ['staff', 'trace', applicantId ?? 'all'] as const,
    traceAll: ['staff', 'trace'] as const,
    mail: (applicantId?: string) => ['staff', 'mail', applicantId ?? 'all'] as const,
    mailAll: ['staff', 'mail'] as const,
    mailDetail: (id: string) => ['staff', 'mail-detail', id] as const,
    stats: ['staff', 'stats'] as const,
  },
};

const SECTION_ALIASES: Record<string, ApplicantSection | ApplicantSection[]> = {
  profile: 'profile',
  applicant: 'profile',
  route: ['profile', 'screen'],
  screen: 'screen',
  files: 'files',
  file: 'files',
  uploads: 'files',
  documents: 'files',
  transcript: 'transcript',
  video: ['files', 'transcript'],
  facts: 'facts',
  fact: 'facts',
  truth_map: 'truth_map',
  truthmap: 'truth_map',
  truth: 'truth_map',
  questions: 'questions',
  question: 'questions',
  chat: 'chat',
  messages: 'chat',
  shortlist: 'shortlist',
  matrix: 'shortlist',
  gaps: 'gaps',
  gap: 'gaps',
  readiness: 'readiness',
  approvals: 'approvals',
  approval: 'approvals',
  letters: 'approvals',
  emails: 'emails',
  email: 'emails',
  mail: 'emails',
  calendar: 'calendar',
  events: 'calendar',
  trace: 'trace',
  brief: 'brief',
};

/** Map `refresh.what` entries to applicant sections. Unknown entries return null (refresh everything). */
export function sectionsFor(what: string[]): ApplicantSection[] | null {
  const out = new Set<ApplicantSection>();
  for (const raw of what) {
    const key = raw.toLowerCase().replace(/[-\s]/g, '_');
    const hit = SECTION_ALIASES[key];
    if (!hit) return null;
    for (const s of Array.isArray(hit) ? hit : [hit]) out.add(s);
  }
  return [...out];
}
