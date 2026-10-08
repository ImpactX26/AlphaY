/**
 * REST contract between apps/api (Claude A) and apps/web (Claude B).
 *
 * All routes live under `/api`. Auth: `Authorization: Bearer <token>`.
 * File downloads (<img>, <video>, PDF links) may pass `?token=<token>` instead.
 * Realtime: socket.io on the same origin, `io({ auth: { token } })`, one event name `msg`
 * carrying a `ServerMessage` (see realtime.ts). Staff may `emit('watch', applicantId)`.
 *
 * Rule for changes: additive only (new optional fields, new endpoints). Anything else,
 * announce it in the commit message with the prefix `contract:`.
 */
import type {
  ApprovalDTO,
  FactDTO,
  PipelineStage,
  QuestionDTO,
  Role,
  Route,
  TraceDTO,
  TruthRow,
} from './domain';
import type { ChatMessageDTO } from './realtime';
import type { MatrixBlock, ScamCheckBlock, Screen } from './screen';

// ---------- auth ----------
// POST /api/auth/register  { email, password, name }        -> AuthResponse  (always role applicant)
// POST /api/auth/login     { email, password }              -> AuthResponse
// POST /api/auth/demo      { persona: DemoPersona }          -> AuthResponse  (one-click demo login)
// GET  /api/auth/me                                          -> MeDTO
export type DemoPersona = 'ananya' | 'rohan' | 'staff' | 'fresh';
export interface MeDTO {
  userId: string;
  role: Role;
  name: string;
  email: string;
  applicantId: string | null;
}
export interface AuthResponse {
  token: string;
  user: MeDTO;
}

// ---------- applicant (applicant may only touch their own id; staff may touch any) ----------
// GET  /api/applicants/:id                    -> ApplicantDTO
// GET  /api/applicants/:id/screen             -> Screen          (also pushed live as {type:'screen'})
// POST /api/applicants/:id/video              multipart field "video" (1 file)  -> FileDTO
// POST /api/applicants/:id/files              multipart field "files" (many)    -> FileDTO[]
// GET  /api/applicants/:id/files              -> FileDTO[]
// GET  /api/files/:fileId/raw?token=          -> the file bytes
// GET  /api/applicants/:id/transcript         -> TranscriptDTO | null
// GET  /api/applicants/:id/facts              -> FactDTO[]
// GET  /api/applicants/:id/truth-map          -> TruthRow[]
// GET  /api/applicants/:id/questions          -> QuestionDTO[]   (open first)
// POST /api/questions/:questionId/answer      { answer }        -> QuestionDTO
// GET  /api/applicants/:id/chat               -> ChatMessageDTO[]
// POST /api/applicants/:id/chat               { text }          -> ChatMessageDTO (agent reply arrives on the socket)
// POST /api/applicants/:id/voice-note         multipart field "audio" -> ChatMessageDTO (transcribed, then treated as chat)
// POST /api/applicants/:id/route              { route }         -> ApplicantDTO   (applicant picks between proposed routes)
// GET  /api/applicants/:id/shortlist          -> ShortlistDTO[]
// POST /api/applicants/:id/shortlist          { programmeId? , openingId?, url? } -> ShortlistDTO (status 'checking', matrix arrives later)
// DELETE /api/shortlist/:shortlistId          -> { ok: true }
// GET  /api/applicants/:id/gaps               -> GapDTO[]
// GET  /api/applicants/:id/readiness          -> ReadinessDTO
// GET  /api/applicants/:id/approvals          -> ApprovalDTO[]
// GET  /api/approvals/:approvalId             -> ApprovalDetailDTO
// POST /api/approvals/:approvalId/approve     { subject?, body? } -> ApprovalDTO   (edits allowed before approving)
// POST /api/approvals/:approvalId/reject      -> ApprovalDTO
// POST /api/applicants/:id/submit             -> ApplicantDTO   ("Submit to Educaro"; staff must approve)
// GET  /api/applicants/:id/final-pack?format=pdf|docx&token=   -> file
// GET  /api/applicants/:id/lebenslauf?format=pdf|docx&token=   -> file
// GET  /api/applicants/:id/emails             -> EmailDTO[]
// GET  /api/applicants/:id/calendar           -> CalendarEventDTO[]
// GET  /api/calendar/:eventId/ics?token=      -> .ics file
// POST /api/applicants/:id/interview          { kind }          -> InterviewDTO
// POST /api/interview/:sessionId/answer       { text }          -> InterviewDTO
// POST /api/applicants/:id/discord-link       -> { code: string }  (user types /link <code> in Discord)
// POST /api/applicants/:id/germany            { city, address?, startDate? } -> ApplicantDTO (visa granted, Germany mode)

export interface ApplicantDTO {
  id: string;
  name: string;
  email: string | null;
  subtitle: string | null;
  homeCity: string | null;
  route: Route | null;
  routeAlternatives: Route[];
  routeReasons: string[];
  targetCity: string | null;
  stage: PipelineStage;
  stageReason: string | null;
  mode: 'onboarding' | 'planning' | 'germany';
  staffSecondKey: boolean;
  submittedAt: string | null;
  approvedByStaffAt: string | null;
  cohortChannel: string | null;
  createdAt: string;
}

export interface FileDTO {
  id: string;
  originalName: string;
  mime: string;
  size: number;
  kind: string;
  kindLabel: string | null;
  status: 'queued' | 'reading' | 'done' | 'unclear';
  confidence: number | null;
  createdAt: string;
  /** What this document was checked against, and whether it passed. */
  check?: DocVerdictDTO | null;
}

export interface TranscriptDTO {
  fileId: string;
  text: string;
  segments: { start: number; end: number; text: string }[];
  provider: string;
}

export interface ShortlistDTO {
  id: string;
  kind: 'programme' | 'opening';
  title: string;
  subtitle: string;
  url: string;
  status: 'checking' | 'ready' | 'gaps';
  gapCount: number;
  matrix: Pick<MatrixBlock, 'rows' | 'exams' | 'deadline'> | null;
  createdAt: string;
}

export interface GapDTO {
  id: string;
  key: string;
  title: string;
  what: string;
  where: string;
  howLong: string;
  cost: string;
  links: { label: string; url: string }[];
  service: { id: string; name: string; url: string } | null;
  status: 'open' | 'planned' | 'done';
  shortlistId: string | null;
}

export interface ReadinessDTO {
  overall: number;
  outcome: 'ready' | 'ready_after_plan' | 'better_route';
  meters: { label: string; value: number }[];
}

/** Letter payload: every sentence links to the facts it uses; keywords come from the target's own page. */
export interface LetterPayload {
  to: string;
  cc: string[];
  replyTo: string;
  subject: string;
  body: string;
  sentences: { text: string; factIds: string[]; keywords: string[] }[];
  keywords: string[];
  attachments: { name: string; fileId?: string }[];
  targetUrl: string | null;
}

export interface ApprovalDetailDTO extends ApprovalDTO {
  facts: FactDTO[]; // the facts referenced by the payload, for "sources beside each sentence"
}

export interface EmailDTO {
  id: string;
  direction: 'out' | 'in';
  fromAddr: string;
  toAddr: string;
  subject: string;
  text: string;
  threadKey: string;
  classified: { kind: 'interview' | 'missing_paper' | 'rejection' | 'other'; summary: string } | null;
  createdAt: string;
}

export interface CalendarEventDTO {
  id: string;
  title: string;
  kind: 'deadline' | 'exam' | 'task' | 'event' | 'interview';
  startsAt: string;
  durationMin: number;
  location: string | null;
  description: string | null;
}

/** One message in the cohort thread. The same post exists in Discord; this is the app's view of it. */
export interface CommunityPostDTO {
  id: string;
  channel: string;
  author: string;
  authorKind: 'applicant' | 'agent' | 'staff';
  applicantId: string | null;
  text: string;
  viaDiscord: boolean;
  replies: CommunityPostDTO[];
  createdAt: string;
}

export interface CohortDTO {
  route: string;
  basis: number;
  steps: { label: string; medianWeeks: number; rangeWeeks: [number, number]; youAre: 'ahead' | 'on_track' | 'behind' | 'not_started' }[];
  peers: { label: string; headline: string; nowAt: string }[];
}

export interface InterviewDTO {
  id: string;
  kind: 'visa' | 'employer' | 'university';
  status: 'active' | 'done';
  turns: { role: 'coach' | 'applicant'; text: string; score?: number; feedback?: string }[];
}

// ---------- staff (role staff only) ----------
// GET  /api/staff/pipeline                    -> PipelineCardDTO[]
// POST /api/staff/applicants/:id/stage        { stage, reason }  -> PipelineCardDTO  (drag back)
// POST /api/staff/applicants/:id/approve-submission              -> ApplicantDTO
// POST /api/staff/applicants/:id/settings     { staffSecondKey } -> ApplicantDTO
// GET  /api/staff/applicants/:id/brief        -> BriefDTO
// POST /api/staff/applicants/:id/consultant   { when? }          -> BriefDTO   (books the call, tells the applicant)
// GET  /api/staff/queue                       -> StaffQueueItemDTO[]  (approval queue)
// POST /api/staff/copilot                     { query }          -> CopilotResultDTO
// GET  /api/staff/openings                    -> OpeningDTO[]
// POST /api/staff/openings                    OpeningInput       -> OpeningDTO
// POST /api/staff/openings/:openingId/match   -> MatchDTO[]   (hard filter in code, then ranked with reasons)
// GET  /api/staff/openings/:openingId/matches -> MatchDTO[]
// POST /api/staff/matches/:matchId/profile    -> MatchDTO     (German one-page profile, anonymised until consent)
// POST /api/staff/matches/:matchId/send       -> ApprovalDTO  (staff approves, mail goes to the employer)
// GET  /api/staff/batch-planner               -> BatchPlanDTO
// GET  /api/staff/broadcasts                  -> BroadcastDTO[]
// POST /api/staff/broadcasts                  { topic }          -> BroadcastDTO (draft, one message per person)
// POST /api/staff/broadcasts/:id/approve      -> BroadcastDTO
// GET  /api/staff/trace?applicantId=&limit=   -> TraceDTO[]
// GET  /api/staff/mail-tracker?applicantId=&limit= -> MailTrackerItemDTO[]  (every mail sent or received, mirrored into Mailpit)
// GET  /api/staff/mail-tracker/:mailpitId     -> MailTrackerDetailDTO
//      The full Mailpit UI is at SystemStatusDTO.mailpitUrl (embed it in an iframe on the staff "Mail tracker" page).
// GET  /api/staff/stats                       -> StatsDTO
// POST /api/staff/simulate-reply              { applicantId, kind: 'interview'|'missing_paper'|'rejection' } -> { ok: true } (demo helper)
// GET  /api/system/status                     -> SystemStatusDTO (no auth)

export interface PipelineCardDTO {
  applicantId: string;
  name: string;
  subtitle: string | null;
  route: Route | null;
  stage: PipelineStage;
  stageReason: string | null;
  readiness: number;
  openGaps: number;
  openQuestions: number;
  pendingApprovals: number;
  conflicts: number;
  updatedAt: string;
}

export interface StaffQueueItemDTO {
  id: string;
  kind: 'approval' | 'submission' | 'low_confidence_read' | 'unproved_conflict' | 'escalation';
  applicantId: string;
  applicantName: string;
  title: string;
  detail: string;
  refId: string | null;
  createdAt: string;
}

export interface CopilotResultDTO {
  query: string;
  interpretation: string;
  columns: string[];
  rows: Record<string, string | number | null>[];
  applicantIds: string[];
}

export interface OpeningInput {
  employer: string;
  employerEmail: string;
  title: string;
  city: string;
  route: Route;
  germanLevel: string;
  startDate: string;
  needsRecognition: boolean;
  description: string;
}
export interface OpeningDTO extends OpeningInput {
  id: string;
  keywords: string[];
  status: string;
  createdAt: string;
}

export interface MatchDTO {
  id: string;
  openingId: string;
  applicantId: string;
  displayName: string; // "Candidate A" until consent, then the real name
  score: number;
  reasons: string[];
  consent: boolean;
  status: 'ranked' | 'profile_ready' | 'sent' | 'interview';
  germanProfile: { headline: string; sections: { title: string; lines: string[] }[] } | null;
}

export interface BriefDTO {
  applicantId: string;
  who: string;
  route: string;
  openGaps: string[];
  agentTried: string[];
  questionsToAsk: string[];
  bookedFor: string | null;
}

export interface BatchPlanDTO {
  months: { month: string; A2: number; B1: number; B2: number }[];
  totals: { A2: number; B1: number; B2: number };
}

export interface BroadcastDTO {
  id: string;
  topic: string;
  status: 'draft' | 'approved' | 'sent';
  messages: { applicantId: string; name: string; text: string }[];
  createdAt: string;
}

/** One row in the mail tracker. `originalTo` differs from `to` when safe mode redirected a third-party recipient. */
export interface MailTrackerItemDTO {
  mailpitId: string;
  direction: 'out' | 'in';
  from: string;
  to: string[];
  originalTo: string[];
  subject: string;
  snippet: string;
  applicantId: string | null;
  applicantName: string | null;
  kind: string | null; // e.g. application, notification, digest, invite, reply
  safeRedirected: boolean;
  createdAt: string;
}
export interface MailTrackerDetailDTO extends MailTrackerItemDTO {
  text: string;
  html: string | null;
  attachments: { name: string; size: number }[];
}

export interface StatsDTO {
  llm: SystemStatusDTO['llm'];
  applicants: number;
  costPerApplicant: { applicantId: string; name: string; costUsd: number; llmCalls: number; cachedCalls: number }[];
}

export interface SystemStatusDTO {
  llm: {
    groq: boolean;
    /** The model running on this machine, when one is configured. */
    local?: string | null;
    openai: boolean;
    openaiModel: string;
    groqModel: string;
    openaiSpentUsd: number;
    openaiBudgetUsd: number;
  };
  discord: boolean;
  mailpitUrl: string;
}

// ---------- safety: "someone sent me this, is it real?" ----------
// POST /api/applicants/:id/check   SafetyCheckInput   -> SafetyCheckDTO
// GET  /api/applicants/:id/checks                     -> SafetyCheckSummaryDTO[]
// POST /api/applicants/:id/report  ReportInput        -> { id, status, createdAt }
// GET  /api/staff/employers                           -> EmployerRatingDTO[]   (staff)
// GET  /api/staff/reports?employer=                   -> EmployerReportDTO[]   (staff)

export interface SafetyCheckInput {
  kind: 'university' | 'employer' | 'landlord' | 'agent' | 'offer';
  name?: string;
  url?: string;
  email?: string;
  /** The offer letter, the message, the contract — whatever they were sent. */
  text?: string;
}

export type SafetyCheckDTO = Omit<ScamCheckBlock, 'id' | 'type' | 'title' | 'body' | 'section' | 'actions' | 'tone'> & { id: string };

export interface SafetyCheckSummaryDTO {
  id: string;
  kind: string;
  subject: string;
  verdict: string;
  score: number;
  createdAt: string;
}

export type ReportCategory = 'pay' | 'hours' | 'housing' | 'documents' | 'respect' | 'safety' | 'other';
export type ReportSeverity = 'note' | 'concern' | 'serious';

export interface ReportInput {
  employer: string;
  text: string;
  category?: ReportCategory;
  severity?: ReportSeverity;
}

/** Built only from the aggregate: one report is a person's experience, not a rating. */
export interface EmployerRatingDTO {
  employer: string;
  rating: number;
  reports: number;
  serious: number;
  themes: string[];
  /** Below three reports we say so, rather than publishing a rating built on one bad week. */
  confident: boolean;
  latest: string | null;
}

export interface EmployerReportDTO {
  id: string;
  employer: string;
  category: ReportCategory;
  severity: ReportSeverity;
  text: string;
  status: 'new' | 'acknowledged' | 'resolved';
  /** Staff see who it was, because they have to act on it. The employer never does. */
  applicantName: string | null;
  applicantId: string | null;
  createdAt: string;
}

// ---------- flat-shares and travel groups ----------
// GET    /api/applicants/:id/groups                        -> CohortGroupsDTO
// POST   /api/applicants/:id/groups                        -> CohortGroupDTO
// POST   /api/applicants/:id/groups/propose { who, kind }  -> { group, invited }
// POST   /api/applicants/:id/groups/:groupId/invite        -> CohortGroupDTO
// POST   /api/applicants/:id/groups/:groupId/request       -> CohortGroupDTO
// POST   /api/applicants/:id/groups/:groupId/respond       -> CohortGroupDTO
// DELETE /api/applicants/:id/groups/:groupId               -> { ok: true }
// GET    /api/staff/groups                                 -> StaffGroupDTO[]  (staff)

export interface CohortGroupMemberDTO {
  /** Null until you are both in: nobody consented to being identifiable in a group they declined. */
  applicantId: string | null;
  label: string;
  route: string;
  homeCity: string | null;
  role: 'owner' | 'member';
  status: 'invited' | 'requested' | 'joined' | 'declined';
}

export interface CohortGroupDTO {
  id: string;
  kind: 'flat_share' | 'travel';
  title: string;
  city: string;
  month: string;
  district: string | null;
  seats: number;
  fromCity: string | null;
  note: string | null;
  status: 'open' | 'full' | 'closed';
  rentSplit: 'even' | 'by_room';
  budgetEachEur: number | null;
  /** The arithmetic, done: "split evenly" is only an answer once it is a number. */
  shareEachEur: number | null;
  /** What the people already in it would each pay today. Null until there are two of them. */
  shareNowEur?: number | null;
  seatsLeft: number;
  members: CohortGroupMemberDTO[];
  /** Null means they have nothing to do with this group yet. */
  youAre: 'invited' | 'requested' | 'joined' | 'declined' | null;
  awaitingYou: boolean;
}

export interface CohortSuggestionDTO {
  city: string;
  month: string;
  district: string | null;
  seats: number;
  budgetEachEur: number;
  candidates: { applicantId: string; label: string; route: string; homeCity: string | null; sharedInterest: string | null }[];
}

export interface CohortGroupsDTO {
  groups: CohortGroupDTO[];
  suggestion: CohortSuggestionDTO | null;
}

export interface StaffGroupDTO {
  id: string;
  kind: 'flat_share' | 'travel';
  title: string;
  city: string;
  month: string;
  status: string;
  seats: number;
  joined: number;
  pending: number;
  shareEachEur: number | null;
  shareNowEur?: number | null;
  members: string[];
  createdAt: string;
}

// ---------- watched sources (admin) ----------
// GET    /api/staff/watch                  -> WatchedSourceDTO[]
// POST   /api/staff/watch  { label, url }  -> WatchedSourceDTO[]
// DELETE /api/staff/watch/:id              -> WatchedSourceDTO[]
// POST   /api/staff/watch/:id/active       -> WatchedSourceDTO[]
// POST   /api/staff/watch/:id/check        -> WatchCheckDTO
// POST   /api/staff/watch/:id/simulate     -> WatchCheckDTO   (demo stand-ins only)
// POST   /api/staff/watch/check-all        -> WatchedSourceDTO[]

export type RequirementDirection = 'easier' | 'harder' | 'added' | 'removed' | 'changed';

export interface RequirementChangeDTO {
  key: string;
  label: string;
  direction: RequirementDirection;
  before: number | null;
  after: number | null;
  beforeText: string | null;
  afterText: string | null;
  summary: string;
}

export interface SourceChangeDTO {
  id: string;
  headline: string;
  changes: RequirementChangeDTO[];
  /** Who we told, and why each of them was on the list. */
  notified: { applicantId: string; name: string; why: string }[];
  createdAt: string;
}

export interface WatchedSourceDTO {
  id: string;
  kind: 'university' | 'government' | 'employer';
  label: string;
  url: string;
  route: string | null;
  active: boolean;
  intervalMinutes: number;
  lastCheckedAt: string | null;
  lastChangedAt: string | null;
  lastError: string | null;
  /** What we understood the page to say at the last read. */
  requirements: { key: string; label: string; shown: string; raw: string }[];
  changes: SourceChangeDTO[];
  /** Only set for the demo stand-ins, which carry more than one version. */
  demoVersion: number | null;
  demoVersions: number | null;
}

export interface WatchCheckDTO {
  changed: boolean;
  changes: RequirementChangeDTO[];
  notified: { applicantId: string; name: string; why: string }[];
}

// ---------- document standards (admin) ----------
// GET   /api/staff/standards              -> DocStandardDTO[]
// PATCH /api/staff/standards/:id          -> DocStandardDTO[]
// GET   /api/staff/standards/failing      -> FailingDocDTO[]
// POST  /api/applicants/:id/recheck-documents -> { rechecked: number }

export type StandardRuleKind =
  | 'required_field'
  | 'not_expired'
  | 'max_age_months'
  | 'min_level'
  | 'min_score'
  | 'issuer_allowed'
  | 'name_matches_passport'
  | 'has_signature_or_stamp'
  | 'min_legible_length';

export interface StandardRuleDTO {
  kind: StandardRuleKind;
  field?: string;
  value?: string | number;
  options?: string[];
  severity: 'blocking' | 'warning';
  /** Why the rule exists, in the words we would use to the applicant. */
  because: string;
}

export interface DocStandardDTO {
  id: string;
  docKind: string;
  label: string;
  /** Where the rule comes from, so a disagreement is with a source and not with us. */
  authority: string;
  active: boolean;
  rules: StandardRuleDTO[];
  updatedAt: string;
}

/** One check that ran against one document. */
export interface DocCheckDTO {
  rule: StandardRuleKind;
  field: string | null;
  passed: boolean;
  severity: 'blocking' | 'warning';
  found: string;
  expected: string;
  because: string;
}

export interface DocVerdictDTO {
  docKind: string;
  standard: string;
  authority: string;
  verdict: 'accepted' | 'accepted_with_notes' | 'not_accepted';
  checks: DocCheckDTO[];
  blocking: number;
  warnings: number;
}

export interface FailingDocDTO {
  fileId: string;
  applicantId: string;
  applicantName: string;
  originalName: string;
  docKind: string;
  standard: string;
  authority: string;
  failed: { rule: StandardRuleKind; found: string; expected: string; because: string }[];
  createdAt: string;
}

// Re-exported elsewhere in the package; imported here so the endpoint comments above type-check in editors.
export type _ContractRefs = [ApprovalDTO, FactDTO, QuestionDTO, TraceDTO, TruthRow, ChatMessageDTO, Screen];
