/**
 * The one typed API client. Every call uses the DTOs from @educaro/shared (api.ts, domain.ts,
 * screen.ts, realtime.ts). Two implementations share this interface: `createHttpApi()` talks to
 * Claude A's NestJS API through the Vite proxy, and `createMockApi()` (src/mock) runs in memory.
 */
import type {
  ApplicantDTO,
  ApprovalDetailDTO,
  ApprovalDTO,
  AuthResponse,
  BatchPlanDTO,
  BriefDTO,
  BroadcastDTO,
  CalendarEventDTO,
  ChatMessageDTO,
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
import { getToken, type ApiMode } from './mode';

export interface ShortlistInput {
  programmeId?: string;
  openingId?: string;
  url?: string;
}
export interface UploadOptions {
  onProgress?: (fraction: number) => void;
}
export type ReplyKind = 'interview' | 'missing_paper' | 'rejection';
export type InterviewKind = InterviewDTO['kind'];
export type PackFormat = 'pdf' | 'docx';

/** Demo-only controls, present in mock mode. */
export interface MockControls {
  reset(): void;
  fastForward(applicantId: string): void;
}

export interface Api {
  readonly mode: ApiMode;
  readonly mock?: MockControls;

  // auth
  register(input: { email: string; password: string; name: string }): Promise<AuthResponse>;
  login(input: { email: string; password: string }): Promise<AuthResponse>;
  demo(persona: DemoPersona): Promise<AuthResponse>;
  me(): Promise<MeDTO>;

  // applicant
  applicant(id: string): Promise<ApplicantDTO>;
  screen(id: string): Promise<Screen>;
  uploadVideo(id: string, file: Blob, filename: string, opts?: UploadOptions): Promise<FileDTO>;
  uploadFiles(id: string, files: File[], opts?: UploadOptions): Promise<FileDTO[]>;
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
  startInterview(id: string, kind: InterviewKind): Promise<InterviewDTO>;
  answerInterview(sessionId: string, text: string): Promise<InterviewDTO>;
  discordLink(id: string): Promise<{ code: string }>;
  germany(id: string, input: { city: string; address?: string; startDate?: string }): Promise<ApplicantDTO>;

  // file links (?token=)
  fileUrl(fileId: string): string;
  finalPackUrl(id: string, format: PackFormat): string;
  lebenslaufUrl(id: string, format: PackFormat): string;
  icsUrl(eventId: string): string;

  // staff
  pipeline(): Promise<PipelineCardDTO[]>;
  moveStage(id: string, stage: PipelineStage, reason: string): Promise<PipelineCardDTO>;
  approveSubmission(id: string): Promise<ApplicantDTO>;
  updateSettings(id: string, input: { staffSecondKey: boolean }): Promise<ApplicantDTO>;
  brief(id: string): Promise<BriefDTO>;
  bookConsultant(id: string, when?: string): Promise<BriefDTO>;
  queue(): Promise<StaffQueueItemDTO[]>;
  copilot(query: string): Promise<CopilotResultDTO>;
  openings(): Promise<OpeningDTO[]>;
  createOpening(input: OpeningInput): Promise<OpeningDTO>;
  runMatch(openingId: string): Promise<MatchDTO[]>;
  matches(openingId: string): Promise<MatchDTO[]>;
  buildProfile(matchId: string): Promise<MatchDTO>;
  sendMatch(matchId: string): Promise<ApprovalDTO>;
  batchPlan(): Promise<BatchPlanDTO>;
  broadcasts(): Promise<BroadcastDTO[]>;
  createBroadcast(topic: string): Promise<BroadcastDTO>;
  approveBroadcast(id: string): Promise<BroadcastDTO>;
  trace(params?: { applicantId?: string; limit?: number }): Promise<TraceDTO[]>;
  mailTracker(params?: { applicantId?: string; limit?: number }): Promise<MailTrackerItemDTO[]>;
  mailTrackerDetail(mailpitId: string): Promise<MailTrackerDetailDTO>;
  stats(): Promise<StatsDTO>;
  simulateReply(input: { applicantId: string; kind: ReplyKind }): Promise<{ ok: true }>;
  systemStatus(): Promise<SystemStatusDTO>;
}

// ---------- errors ----------
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler = () => {};
export function setUnauthorizedHandler(fn: UnauthorizedHandler) {
  onUnauthorized = fn;
}

function messageFrom(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const m = (body as { message: unknown }).message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m)) return m.filter((x): x is string => typeof x === 'string').join('. ') || fallback;
  }
  return fallback;
}

function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function request<T>(method: 'GET' | 'POST' | 'DELETE' | 'PATCH', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }
  const parsed = parseBody(await res.text());
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) throw new ApiError(res.status, messageFrom(parsed, `Request failed (${res.status})`));
  return parsed as T;
}

/** Multipart upload with progress (fetch has no upload progress). */
function upload<T>(path: string, form: FormData, opts?: UploadOptions): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api${path}`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts?.onProgress) opts.onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      const parsed = parseBody(xhr.responseText);
      if (xhr.status === 401 && token) onUnauthorized();
      if (xhr.status >= 200 && xhr.status < 300) {
        opts?.onProgress?.(1);
        resolve(parsed as T);
      } else reject(new ApiError(xhr.status, messageFrom(parsed, `Upload failed (${xhr.status})`)));
    };
    xhr.onerror = () => reject(new ApiError(0, 'Upload failed. Check your connection and try again.'));
    xhr.send(form);
  });
}

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

function withToken(path: string, params: Record<string, string> = {}): string {
  const token = getToken();
  return `/api${path}${qs({ ...params, token: token ?? undefined })}`;
}

const enc = encodeURIComponent;

export function createHttpApi(): Api {
  return {
    mode: 'live',

    register: (input) => request('POST', '/auth/register', input),
    login: (input) => request('POST', '/auth/login', input),
    demo: (persona) => request('POST', '/auth/demo', { persona }),
    me: () => request('GET', '/auth/me'),

    applicant: (id) => request('GET', `/applicants/${enc(id)}`),
    screen: (id) => request('GET', `/applicants/${enc(id)}/screen`),
    uploadVideo: (id, file, filename, opts) => {
      const form = new FormData();
      form.append('video', file, filename);
      return upload(`/applicants/${enc(id)}/video`, form, opts);
    },
    uploadFiles: (id, files, opts) => {
      const form = new FormData();
      for (const f of files) form.append('files', f, f.name);
      return upload(`/applicants/${enc(id)}/files`, form, opts);
    },
    files: (id) => request('GET', `/applicants/${enc(id)}/files`),
    transcript: (id) => request('GET', `/applicants/${enc(id)}/transcript`),
    facts: (id) => request('GET', `/applicants/${enc(id)}/facts`),
    truthMap: (id) => request('GET', `/applicants/${enc(id)}/truth-map`),
    questions: (id) => request('GET', `/applicants/${enc(id)}/questions`),
    answerQuestion: (questionId, answer) => request('POST', `/questions/${enc(questionId)}/answer`, { answer }),
    chat: (id) => request('GET', `/applicants/${enc(id)}/chat`),
    sendChat: (id, text) => request('POST', `/applicants/${enc(id)}/chat`, { text }),
    sendVoiceNote: (id, audio, filename) => {
      const form = new FormData();
      form.append('audio', audio, filename);
      return upload(`/applicants/${enc(id)}/voice-note`, form);
    },
    setRoute: (id, route) => request('POST', `/applicants/${enc(id)}/route`, { route }),
    shortlist: (id) => request('GET', `/applicants/${enc(id)}/shortlist`),
    addShortlist: (id, input) => request('POST', `/applicants/${enc(id)}/shortlist`, input),
    removeShortlist: (shortlistId) => request('DELETE', `/shortlist/${enc(shortlistId)}`),
    gaps: (id) => request('GET', `/applicants/${enc(id)}/gaps`),
    readiness: (id) => request('GET', `/applicants/${enc(id)}/readiness`),
    approvals: (id) => request('GET', `/applicants/${enc(id)}/approvals`),
    approval: (approvalId) => request('GET', `/approvals/${enc(approvalId)}`),
    approve: (approvalId, edits) => request('POST', `/approvals/${enc(approvalId)}/approve`, edits ?? {}),
    reject: (approvalId) => request('POST', `/approvals/${enc(approvalId)}/reject`, {}),
    submit: (id) => request('POST', `/applicants/${enc(id)}/submit`, {}),
    emails: (id) => request('GET', `/applicants/${enc(id)}/emails`),
    calendar: (id) => request('GET', `/applicants/${enc(id)}/calendar`),
    startInterview: (id, kind) => request('POST', `/applicants/${enc(id)}/interview`, { kind }),
    answerInterview: (sessionId, text) => request('POST', `/interview/${enc(sessionId)}/answer`, { text }),
    discordLink: (id) => request('POST', `/applicants/${enc(id)}/discord-link`, {}),
    germany: (id, input) => request('POST', `/applicants/${enc(id)}/germany`, input),

    fileUrl: (fileId) => withToken(`/files/${enc(fileId)}/raw`),
    finalPackUrl: (id, format) => withToken(`/applicants/${enc(id)}/final-pack`, { format }),
    lebenslaufUrl: (id, format) => withToken(`/applicants/${enc(id)}/lebenslauf`, { format }),
    icsUrl: (eventId) => withToken(`/calendar/${enc(eventId)}/ics`),

    pipeline: () => request('GET', '/staff/pipeline'),
    moveStage: (id, stage, reason) => request('POST', `/staff/applicants/${enc(id)}/stage`, { stage, reason }),
    approveSubmission: (id) => request('POST', `/staff/applicants/${enc(id)}/approve-submission`, {}),
    updateSettings: (id, input) => request('POST', `/staff/applicants/${enc(id)}/settings`, input),
    brief: (id) => request('GET', `/staff/applicants/${enc(id)}/brief`),
    bookConsultant: (id, when) => request('POST', `/staff/applicants/${enc(id)}/consultant`, when ? { when } : {}),
    queue: () => request('GET', '/staff/queue'),
    copilot: (query) => request('POST', '/staff/copilot', { query }),
    openings: () => request('GET', '/staff/openings'),
    createOpening: (input) => request('POST', '/staff/openings', input),
    runMatch: (openingId) => request('POST', `/staff/openings/${enc(openingId)}/match`, {}),
    matches: (openingId) => request('GET', `/staff/openings/${enc(openingId)}/matches`),
    buildProfile: (matchId) => request('POST', `/staff/matches/${enc(matchId)}/profile`, {}),
    sendMatch: (matchId) => request('POST', `/staff/matches/${enc(matchId)}/send`, {}),
    batchPlan: () => request('GET', '/staff/batch-planner'),
    broadcasts: () => request('GET', '/staff/broadcasts'),
    createBroadcast: (topic) => request('POST', '/staff/broadcasts', { topic }),
    approveBroadcast: (id) => request('POST', `/staff/broadcasts/${enc(id)}/approve`, {}),
    trace: (params) => request('GET', `/staff/trace${qs({ applicantId: params?.applicantId, limit: params?.limit })}`),
    mailTracker: (params) =>
      request('GET', `/staff/mail-tracker${qs({ applicantId: params?.applicantId, limit: params?.limit })}`),
    mailTrackerDetail: (mailpitId) => request('GET', `/staff/mail-tracker/${enc(mailpitId)}`),
    stats: () => request('GET', '/staff/stats'),
    simulateReply: (input) => request('POST', '/staff/simulate-reply', input),
    systemStatus: () => request('GET', '/system/status'),
  };
}

/** The active client. Installed once in main.tsx before the first render. */
export let api!: Api;
export function installApi(impl: Api) {
  api = impl;
}
