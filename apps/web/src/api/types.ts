import type {
  WatchCheckDTO,
  WatchedSourceDTO,
  CohortGroupDTO,
  CohortGroupsDTO,
  StaffGroupDTO,
  EmployerRatingDTO,
  EmployerReportDTO,
  ReportInput,
  SafetyCheckDTO,
  SafetyCheckInput,
  SafetyCheckSummaryDTO,
  ApplicantDTO,
  ApprovalDetailDTO,
  ApprovalDTO,
  AuthResponse,
  BatchPlanDTO,
  BriefDTO,
  BroadcastDTO,
  CalendarEventDTO,
  ChatMessageDTO,
  CohortDTO,
  CommunityPostDTO,
  CopilotResultDTO,
  DemoPersona,
  EmailDTO,
  FactDTO,
  FileDTO,
  GapDTO,
  InterviewDTO,
  MailTrackerDetailDTO,
  MailTrackerItemDTO,
  MatchDTO,
  RentalsBlock,
  MeDTO,
  OpeningDTO,
  OpeningInput,
  PipelineCardDTO,
  PipelineStage,
  QuestionDTO,
  ReadinessDTO,
  Route,
  Screen,
  ShortlistDTO,
  StaffQueueItemDTO,
  StatsDTO,
  SystemStatusDTO,
  TraceDTO,
  TranscriptDTO,
  TruthRow,
} from '@educaro/shared';

export type UploadProgress = (fraction: number) => void;

export interface ShortlistInput {
  programmeId?: string;
  openingId?: string;
  url?: string;
}

export type ReplyKind = 'interview' | 'missing_paper' | 'rejection';

/**
 * Every endpoint in packages/shared/src/api.ts, one typed function each.
 * `httpApi` (client.ts) talks to the NestJS API; `mockApi` (mock.ts) runs in the browser.
 */
export interface Api {
  // auth
  register(input: { email: string; password: string; name: string }): Promise<AuthResponse>;
  login(input: { email: string; password: string }): Promise<AuthResponse>;
  demo(persona: DemoPersona): Promise<AuthResponse>;
  me(): Promise<MeDTO>;

  // applicant
  applicant(id: string): Promise<ApplicantDTO>;
  screen(id: string): Promise<Screen>;
  uploadVideo(id: string, video: Blob, filename: string, onProgress?: UploadProgress): Promise<FileDTO>;
  uploadFiles(id: string, files: File[], onProgress?: UploadProgress): Promise<FileDTO[]>;
  files(id: string): Promise<FileDTO[]>;
  transcript(id: string): Promise<TranscriptDTO | null>;
  facts(id: string): Promise<FactDTO[]>;
  truthMap(id: string): Promise<TruthRow[]>;
  questions(id: string): Promise<QuestionDTO[]>;
  answerQuestion(questionId: string, answer: string): Promise<QuestionDTO>;
  chat(id: string): Promise<ChatMessageDTO[]>;
  sendChat(id: string, text: string): Promise<ChatMessageDTO>;
  sendVoiceNote(id: string, audio: Blob, filename: string): Promise<ChatMessageDTO>;
  setRoute(id: string, route: Route): Promise<ApplicantDTO>;
  shortlist(id: string): Promise<ShortlistDTO[]>;
  addShortlist(id: string, input: ShortlistInput): Promise<ShortlistDTO>;
  removeShortlist(shortlistId: string): Promise<{ ok: true }>;
  gaps(id: string): Promise<GapDTO[]>;
  readiness(id: string): Promise<ReadinessDTO>;
  approvals(id: string): Promise<ApprovalDTO[]>;
  approval(approvalId: string): Promise<ApprovalDetailDTO>;
  approve(approvalId: string, edits?: { subject?: string; body?: string }): Promise<ApprovalDTO>;
  reject(approvalId: string): Promise<ApprovalDTO>;
  submit(id: string): Promise<ApplicantDTO>;
  emails(id: string): Promise<EmailDTO[]>;
  calendar(id: string): Promise<CalendarEventDTO[]>;
  startInterview(id: string, kind: InterviewDTO['kind']): Promise<InterviewDTO>;
  answerInterview(sessionId: string, text: string): Promise<InterviewDTO>;
  discordLink(id: string): Promise<{ code: string }>;
  germany(id: string, input: { city: string; address?: string; startDate?: string }): Promise<ApplicantDTO>;
  rentals(id: string): Promise<RentalsBlock>;
  cohort(id: string): Promise<CohortDTO>;
  groups(id: string): Promise<CohortGroupsDTO>;
  proposeShare(id: string, who: string, kind?: 'flat_share' | 'travel'): Promise<{ group: CohortGroupDTO; invited: { applicantId: string; label: string } }>;
  respondToGroup(id: string, groupId: string, accept: boolean): Promise<CohortGroupDTO>;
  requestGroup(id: string, groupId: string): Promise<CohortGroupDTO>;
  leaveGroup(id: string, groupId: string): Promise<{ ok: true }>;
  staffGroups(): Promise<StaffGroupDTO[]>;
  watchedSources(): Promise<WatchedSourceDTO[]>;
  addSource(input: { kind?: WatchedSourceDTO['kind']; label: string; url: string; route?: string; intervalMinutes?: number }): Promise<WatchedSourceDTO[]>;
  removeSource(id: string): Promise<WatchedSourceDTO[]>;
  setSourceActive(id: string, active: boolean): Promise<WatchedSourceDTO[]>;
  checkSource(id: string): Promise<WatchCheckDTO>;
  checkAllSources(): Promise<WatchedSourceDTO[]>;
  simulateSource(id: string): Promise<WatchCheckDTO>;
  check(id: string, input: SafetyCheckInput): Promise<SafetyCheckDTO>;
  checks(id: string): Promise<SafetyCheckSummaryDTO[]>;
  report(id: string, input: ReportInput): Promise<{ id: string; status: string; createdAt: string }>;
  employerRatings(): Promise<EmployerRatingDTO[]>;
  employerReports(employer?: string): Promise<EmployerReportDTO[]>;
  community(): Promise<CommunityPostDTO[]>;
  postToCommunity(input: { text: string; applicantId: string }): Promise<CommunityPostDTO>;
  replyInCommunity(postId: string, text: string): Promise<CommunityPostDTO>;

  // staff
  pipeline(): Promise<PipelineCardDTO[]>;
  setStage(id: string, stage: PipelineStage, reason: string): Promise<PipelineCardDTO>;
  approveSubmission(id: string): Promise<ApplicantDTO>;
  setSettings(id: string, settings: { staffSecondKey: boolean }): Promise<ApplicantDTO>;
  brief(id: string): Promise<BriefDTO>;
  bookConsultant(id: string, when?: string): Promise<BriefDTO>;
  queue(): Promise<StaffQueueItemDTO[]>;
  copilot(query: string): Promise<CopilotResultDTO>;
  openings(): Promise<OpeningDTO[]>;
  createOpening(input: OpeningInput): Promise<OpeningDTO>;
  matchOpening(openingId: string): Promise<MatchDTO[]>;
  matches(openingId: string): Promise<MatchDTO[]>;
  buildProfile(matchId: string): Promise<MatchDTO>;
  sendMatch(matchId: string): Promise<ApprovalDTO>;
  batchPlanner(): Promise<BatchPlanDTO>;
  broadcasts(): Promise<BroadcastDTO[]>;
  createBroadcast(topic: string): Promise<BroadcastDTO>;
  approveBroadcast(id: string): Promise<BroadcastDTO>;
  trace(params?: { applicantId?: string; limit?: number }): Promise<TraceDTO[]>;
  mailTracker(params?: { applicantId?: string; limit?: number }): Promise<MailTrackerItemDTO[]>;
  mailTrackerDetail(mailpitId: string): Promise<MailTrackerDetailDTO>;
  stats(): Promise<StatsDTO>;
  simulateReply(applicantId: string, kind: ReplyKind): Promise<{ ok: true }>;
  systemStatus(): Promise<SystemStatusDTO>;
}
