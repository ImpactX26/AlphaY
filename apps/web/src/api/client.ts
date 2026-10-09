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
  CohortDTO,
  CohortGroupDTO,
  DocStandardDTO,
  FailingDocDTO,
  CohortGroupsDTO,
  CommunityPostDTO,
  CopilotResultDTO,
  EmailDTO,
  EmployerRatingDTO,
  EmployerReportDTO,
  FactDTO,
  FileDTO,
  GapDTO,
  InterviewDTO,
  InterviewVoiceDTO,
  MailTrackerDetailDTO,
  MailTrackerItemDTO,
  MatchDTO,
  MeDTO,
  OpeningDTO,
  PipelineCardDTO,
  QuestionDTO,
  ReadinessDTO,
  SafetyCheckDTO,
  SafetyCheckSummaryDTO,
  RentalsBlock,
  Screen,
  ShortlistDTO,
  StaffQueueItemDTO,
  StaffGroupDTO,
  StatsDTO,
  SystemStatusDTO,
  TraceDTO,
  TranscriptDTO,
  TailorDraftDTO,
  TailorReportDTO,
  TruthRow,
  WatchCheckDTO,
  WatchedSourceDTO,
} from '@educaro/shared';
import { ApiError } from './errors';
import { tokenStore } from './token';
import type { Api, UploadProgress } from './types';

export { ApiError, errorText } from './errors';
export { isMock, setMockMode, tokenStore } from './token';

type Method = 'GET' | 'POST' | 'DELETE' | 'PATCH';
type Query = Record<string, string | number | undefined>;

let unauthorizedHandler: (() => void) | null = null;
/** Called on any 401, so the app can drop the session and show sign-in. */
export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

function parse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message: unknown }).message;
    if (typeof m === 'string' && m) return m;
    if (Array.isArray(m)) return m.filter((x): x is string => typeof x === 'string').join('. ');
  }
  if (typeof body === 'string' && body.length < 200) return body;
  return fallback;
}

function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') params.set(k, String(v));
  const s = params.toString();
  return s ? `${path}?${s}` : path;
}

/**
 * A path segment, encoded.
 *
 * It refuses an empty one. `encodeURIComponent('')` is `''`, which silently collapses
 * `/applicants/${id}/video` into `/applicants//video` — a 404 that looks like a broken endpoint
 * rather than a missing id, and it cost an afternoon of looking at the wrong side of the wire.
 */
const seg = (value: string): string => {
  if (!value) throw new ApiError(0, 'Missing an id for this request. Try signing in again.', null);
  return encodeURIComponent(value);
};

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = tokenStore.get();
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
    throw new ApiError(0, 'Cannot reach the Educaro server. Check that the API is running.', null);
  }
  const data = parse(await res.text());
  if (res.status === 401 && unauthorizedHandler) unauthorizedHandler();
  if (!res.ok) throw new ApiError(res.status, errorMessage(data, res.statusText || `Request failed (${res.status})`), data);
  return data as T;
}

/** Multipart upload with progress (fetch cannot report upload progress). */
function upload<T>(path: string, form: FormData, onProgress?: UploadProgress): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api${path}`);
    const token = tokenStore.get();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      const data = parse(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else {
        if (xhr.status === 401 && unauthorizedHandler) unauthorizedHandler();
        reject(new ApiError(xhr.status, errorMessage(data, 'The upload failed. Try again.'), data));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'The upload stopped: the connection dropped. Try again.', null));
    xhr.send(form);
  });
}

const get = <T>(path: string, query?: Query) => request<T>('GET', withQuery(path, query));
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {});
const del = <T>(path: string) => request<T>('DELETE', path);
const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {});

export const httpApi: Api = {
  register: (input) => post<AuthResponse>('/auth/register', input),
  login: (input) => post<AuthResponse>('/auth/login', input),
  demo: (persona) => post<AuthResponse>('/auth/demo', { persona }),
  me: () => get<MeDTO>('/auth/me'),

  applicant: (id) => get<ApplicantDTO>(`/applicants/${seg(id)}`),
  screen: (id) => get<Screen>(`/applicants/${seg(id)}/screen`),
  uploadVideo: (id, video, filename, onProgress) => {
    const form = new FormData();
    form.append('video', video, filename);
    return upload<FileDTO>(`/applicants/${seg(id)}/video`, form, onProgress);
  },
  uploadFiles: (id, files, onProgress) => {
    const form = new FormData();
    for (const f of files) form.append('files', f, f.name);
    return upload<FileDTO[]>(`/applicants/${seg(id)}/files`, form, onProgress);
  },
  files: (id) => get<FileDTO[]>(`/applicants/${seg(id)}/files`),
  transcript: (id) => get<TranscriptDTO | null>(`/applicants/${seg(id)}/transcript`),
  facts: (id) => get<FactDTO[]>(`/applicants/${seg(id)}/facts`),
  truthMap: (id) => get<TruthRow[]>(`/applicants/${seg(id)}/truth-map`),
  questions: (id) => get<QuestionDTO[]>(`/applicants/${seg(id)}/questions`),
  answerQuestion: (questionId, answer) => post<QuestionDTO>(`/questions/${seg(questionId)}/answer`, { answer }),
  chat: (id) => get<ChatMessageDTO[]>(`/applicants/${seg(id)}/chat`),
  sendChat: (id, text) => post<ChatMessageDTO>(`/applicants/${seg(id)}/chat`, { text }),
  sendVoiceNote: (id, audio, filename) => {
    const form = new FormData();
    form.append('audio', audio, filename);
    return upload<ChatMessageDTO>(`/applicants/${seg(id)}/voice-note`, form);
  },
  setRoute: (id, route) => post<ApplicantDTO>(`/applicants/${seg(id)}/route`, { route }),
  shortlist: (id) => get<ShortlistDTO[]>(`/applicants/${seg(id)}/shortlist`),
  addShortlist: (id, input) => post<ShortlistDTO>(`/applicants/${seg(id)}/shortlist`, input),
  removeShortlist: (shortlistId) => del<{ ok: true }>(`/shortlist/${seg(shortlistId)}`),
  draftApplication: (shortlistId) => post<ApprovalDTO>(`/shortlist/${seg(shortlistId)}/draft`, {}),
  gaps: (id) => get<GapDTO[]>(`/applicants/${seg(id)}/gaps`),
  readiness: (id) => get<ReadinessDTO>(`/applicants/${seg(id)}/readiness`),
  approvals: (id) => get<ApprovalDTO[]>(`/applicants/${seg(id)}/approvals`),
  approval: (approvalId) => get<ApprovalDetailDTO>(`/approvals/${seg(approvalId)}`),
  approve: (approvalId, edits) => post<ApprovalDTO>(`/approvals/${seg(approvalId)}/approve`, edits ?? {}),
  reject: (approvalId) => post<ApprovalDTO>(`/approvals/${seg(approvalId)}/reject`),
  submit: (id) => post<ApplicantDTO>(`/applicants/${seg(id)}/submit`),
  emails: (id) => get<EmailDTO[]>(`/applicants/${seg(id)}/emails`),
  calendar: (id) => get<CalendarEventDTO[]>(`/applicants/${seg(id)}/calendar`),
  startInterview: (id, kind) => post<InterviewDTO>(`/applicants/${seg(id)}/interview`, { kind }),
  answerInterview: (sessionId, text) => post<InterviewDTO>(`/interview/${seg(sessionId)}/answer`, { text }),
  /**
   * The question as real speech, or null when no voice is configured (the API answers 204) or the
   * request fails. Null is normal: the caller reads it with the browser's own voice instead.
   * Its own fetch because `request` parses JSON and this is audio.
   */
  interviewSay: async (sessionId, text) => {
    const token = tokenStore.get();
    try {
      const res = await fetch(`/api/interview/${seg(sessionId)}/say`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text }),
      });
      if (res.status === 204 || !res.ok) return null;
      const blob = await res.blob();
      return blob.size ? blob : null;
    } catch {
      return null;
    }
  },
  answerInterviewByVoice: (sessionId, audio, filename) => {
    const form = new FormData();
    form.append('audio', audio, filename);
    return upload<InterviewVoiceDTO>(`/interview/${seg(sessionId)}/answer-voice`, form);
  },
  discordLink: (id) => post<{ code: string }>(`/applicants/${seg(id)}/discord-link`),
  germany: (id, input) => post<ApplicantDTO>(`/applicants/${seg(id)}/germany`, input),
  rentals: (id) => get<RentalsBlock>(`/applicants/${seg(id)}/rentals`),
  cohort: (id) => get<CohortDTO>(`/applicants/${seg(id)}/cohort`),
  groups: (id) => get<CohortGroupsDTO>(`/applicants/${seg(id)}/groups`),
  proposeShare: (id, who, kind) => post<{ group: CohortGroupDTO; invited: { applicantId: string; label: string } }>(`/applicants/${seg(id)}/groups/propose`, { who, kind }),
  respondToGroup: (id, groupId, accept) => post<CohortGroupDTO>(`/applicants/${seg(id)}/groups/${seg(groupId)}/respond`, { accept }),
  requestGroup: (id, groupId) => post<CohortGroupDTO>(`/applicants/${seg(id)}/groups/${seg(groupId)}/request`),
  leaveGroup: (id, groupId) => del<{ ok: true }>(`/applicants/${seg(id)}/groups/${seg(groupId)}`),
  staffGroups: () => get<StaffGroupDTO[]>('/staff/groups'),
  tailorReport: (id, shortlistId) => get<TailorReportDTO>(`/applicants/${seg(id)}/tailor`, { shortlistId }),
  draftTailored: (id, input) => post<TailorDraftDTO>(`/applicants/${seg(id)}/tailor`, input),
  docStandards: () => get<DocStandardDTO[]>('/staff/standards'),
  updateStandard: (id, input) => patch<DocStandardDTO[]>(`/staff/standards/${seg(id)}`, input),
  failingDocuments: () => get<FailingDocDTO[]>('/staff/standards/failing'),
  recheckDocuments: (id) => post<{ rechecked: number }>(`/applicants/${seg(id)}/recheck-documents`),
  watchedSources: () => get<WatchedSourceDTO[]>('/staff/watch'),
  addSource: (input) => post<WatchedSourceDTO[]>('/staff/watch', input),
  removeSource: (id) => del<WatchedSourceDTO[]>(`/staff/watch/${seg(id)}`),
  setSourceActive: (id, active) => post<WatchedSourceDTO[]>(`/staff/watch/${seg(id)}/active`, { active }),
  checkSource: (id) => post<WatchCheckDTO>(`/staff/watch/${seg(id)}/check`),
  checkAllSources: () => post<WatchedSourceDTO[]>('/staff/watch/check-all'),
  simulateSource: (id) => post<WatchCheckDTO>(`/staff/watch/${seg(id)}/simulate`),
  check: (id, input) => post<SafetyCheckDTO>(`/applicants/${seg(id)}/check`, input),
  checks: (id) => get<SafetyCheckSummaryDTO[]>(`/applicants/${seg(id)}/checks`),
  report: (id, input) => post<{ id: string; status: string; createdAt: string }>(`/applicants/${seg(id)}/report`, input),
  employerRatings: () => get<EmployerRatingDTO[]>('/staff/employers'),
  employerReports: (employer) => get<EmployerReportDTO[]>('/staff/reports', { employer }),
  community: () => get<CommunityPostDTO[]>('/community'),
  announcements: (limit) => get<CommunityPostDTO[]>('/community/announcements', { limit }),
  postToCommunity: (input) => post<CommunityPostDTO>('/community', input),
  replyInCommunity: (postId, text) => post<CommunityPostDTO>(`/community/${seg(postId)}/reply`, { text }),

  pipeline: () => get<PipelineCardDTO[]>('/staff/pipeline'),
  setStage: (id, stage, reason) => post<PipelineCardDTO>(`/staff/applicants/${seg(id)}/stage`, { stage, reason }),
  approveSubmission: (id) => post<ApplicantDTO>(`/staff/applicants/${seg(id)}/approve-submission`),
  setSettings: (id, settings) => post<ApplicantDTO>(`/staff/applicants/${seg(id)}/settings`, settings),
  brief: (id) => get<BriefDTO>(`/staff/applicants/${seg(id)}/brief`),
  bookConsultant: (id, when) => post<BriefDTO>(`/staff/applicants/${seg(id)}/consultant`, when ? { when } : {}),
  queue: () => get<StaffQueueItemDTO[]>('/staff/queue'),
  copilot: (query) => post<CopilotResultDTO>('/staff/copilot', { query }),
  openings: () => get<OpeningDTO[]>('/staff/openings'),
  createOpening: (input) => post<OpeningDTO>('/staff/openings', input),
  matchOpening: (openingId) => post<MatchDTO[]>(`/staff/openings/${seg(openingId)}/match`),
  matches: (openingId) => get<MatchDTO[]>(`/staff/openings/${seg(openingId)}/matches`),
  buildProfile: (matchId) => post<MatchDTO>(`/staff/matches/${seg(matchId)}/profile`),
  sendMatch: (matchId) => post<ApprovalDTO>(`/staff/matches/${seg(matchId)}/send`),
  batchPlanner: () => get<BatchPlanDTO>('/staff/batch-planner'),
  broadcasts: () => get<BroadcastDTO[]>('/staff/broadcasts'),
  createBroadcast: (topic) => post<BroadcastDTO>('/staff/broadcasts', { topic }),
  approveBroadcast: (id) => post<BroadcastDTO>(`/staff/broadcasts/${seg(id)}/approve`),
  trace: (params) => get<TraceDTO[]>('/staff/trace', params),
  mailTracker: (params) => get<MailTrackerItemDTO[]>('/staff/mail-tracker', params),
  mailTrackerDetail: (mailpitId) => get<MailTrackerDetailDTO>(`/staff/mail-tracker/${seg(mailpitId)}`),
  stats: () => get<StatsDTO>('/staff/stats'),
  simulateReply: (applicantId, kind) => post<{ ok: true }>('/staff/simulate-reply', { applicantId, kind }),
  systemStatus: () => get<SystemStatusDTO>('/system/status'),
};

export const api: Api = httpApi;

/** Links for <a>, <img> and <video>: the token travels as ?token= because tags cannot send headers. */
function tokenUrl(path: string, query?: Query): string {
  return withQuery(`/api${path}`, { ...query, token: tokenStore.get() ?? undefined });
}

export const links = {
  file: (fileId: string): string | null => tokenUrl(`/files/${seg(fileId)}/raw`),
  finalPack: (id: string, format: 'pdf' | 'docx'): string => tokenUrl(`/applicants/${seg(id)}/final-pack`, { format }),
  lebenslauf: (id: string, format: 'pdf' | 'docx'): string => tokenUrl(`/applicants/${seg(id)}/lebenslauf`, { format }),
  ics: (eventId: string): string => tokenUrl(`/calendar/${seg(eventId)}/ics`),
};
