import type { ChatMessageDTO, FileDTO } from '@educaro/shared';
import { type QueryKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { ShortlistInput } from './types';

type Id = string | null | undefined;

/** Query keys. Everything about one applicant sits under ['applicant', id] so one call refreshes it all. */
export const qk = {
  me: ['me'] as const,
  applicantAll: (id: string) => ['applicant', id] as const,
  applicant: (id: string) => ['applicant', id, 'profile'] as const,
  screen: (id: string) => ['applicant', id, 'screen'] as const,
  files: (id: string) => ['applicant', id, 'files'] as const,
  transcript: (id: string) => ['applicant', id, 'transcript'] as const,
  facts: (id: string) => ['applicant', id, 'facts'] as const,
  truth: (id: string) => ['applicant', id, 'truth-map'] as const,
  questions: (id: string) => ['applicant', id, 'questions'] as const,
  chat: (id: string) => ['applicant', id, 'chat'] as const,
  shortlist: (id: string) => ['applicant', id, 'shortlist'] as const,
  gaps: (id: string) => ['applicant', id, 'gaps'] as const,
  readiness: (id: string) => ['applicant', id, 'readiness'] as const,
  approvals: (id: string) => ['applicant', id, 'approvals'] as const,
  emails: (id: string) => ['applicant', id, 'emails'] as const,
  calendar: (id: string) => ['applicant', id, 'calendar'] as const,
  approval: (approvalId: string) => ['approval', approvalId] as const,
  pipeline: ['staff', 'pipeline'] as const,
  queue: ['staff', 'queue'] as const,
  brief: (id: string) => ['staff', 'brief', id] as const,
  openings: ['staff', 'openings'] as const,
  matches: (openingId: string) => ['staff', 'matches', openingId] as const,
  batch: ['staff', 'batch'] as const,
  broadcasts: ['staff', 'broadcasts'] as const,
  trace: (applicantId?: string) => ['staff', 'trace', applicantId ?? 'all'] as const,
  mail: (applicantId?: string) => ['staff', 'mail', applicantId ?? 'all'] as const,
  mailDetail: (mailpitId: string) => ['staff', 'mail-detail', mailpitId] as const,
  stats: ['staff', 'stats'] as const,
  system: ['system'] as const,
};

/** Keys a `refresh` socket message can name, mapped to the queries to refetch. */
export function keysForRefresh(applicantId: string, what: string): QueryKey[] {
  switch (what) {
    case '*':
    case 'all':
      return [qk.applicantAll(applicantId), ['staff'], ['approval']];
    case 'applicant':
    case 'profile':
      return [qk.applicant(applicantId), qk.pipeline];
    case 'truth':
    case 'truth_map':
    case 'truth-map':
      return [qk.truth(applicantId)];
    case 'approvals':
      return [qk.approvals(applicantId), ['approval'], qk.queue];
    case 'queue':
    case 'submission':
      return [qk.queue, qk.applicant(applicantId)];
    case 'pipeline':
      return [qk.pipeline];
    case 'matches':
      return [['staff', 'matches']];
    case 'broadcasts':
      return [qk.broadcasts];
    case 'trace':
      return [['staff', 'trace']];
    case 'mail':
    case 'emails':
      return [qk.emails(applicantId), ['staff', 'mail']];
    case 'readiness':
      return [qk.readiness(applicantId), qk.pipeline];
    default:
      return [['applicant', applicantId, what]];
  }
}

// ---------- applicant ----------

export const useApplicant = (id: Id) =>
  useQuery({ queryKey: qk.applicant(id ?? ''), queryFn: () => api.applicant(id ?? ''), enabled: !!id });
export const useScreen = (id: Id) => useQuery({ queryKey: qk.screen(id ?? ''), queryFn: () => api.screen(id ?? ''), enabled: !!id });
export const useFiles = (id: Id) =>
  useQuery({
    queryKey: qk.files(id ?? ''),
    queryFn: () => api.files(id ?? ''),
    enabled: !!id,
    // Poll while anything is still being read, in case a socket message is missed.
    refetchInterval: (q) => (q.state.data?.some((f: FileDTO) => f.status === 'queued' || f.status === 'reading') ? 3000 : false),
  });
export const useTranscript = (id: Id) =>
  useQuery({ queryKey: qk.transcript(id ?? ''), queryFn: () => api.transcript(id ?? ''), enabled: !!id });
export const useFacts = (id: Id) => useQuery({ queryKey: qk.facts(id ?? ''), queryFn: () => api.facts(id ?? ''), enabled: !!id });
export const useTruthMap = (id: Id) => useQuery({ queryKey: qk.truth(id ?? ''), queryFn: () => api.truthMap(id ?? ''), enabled: !!id });
export const useQuestions = (id: Id) =>
  useQuery({ queryKey: qk.questions(id ?? ''), queryFn: () => api.questions(id ?? ''), enabled: !!id });
export const useChat = (id: Id) => useQuery({ queryKey: qk.chat(id ?? ''), queryFn: () => api.chat(id ?? ''), enabled: !!id });
export const useShortlist = (id: Id) =>
  useQuery({
    queryKey: qk.shortlist(id ?? ''),
    queryFn: () => api.shortlist(id ?? ''),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.some((s) => s.status === 'checking') ? 4000 : false),
  });
export const useGaps = (id: Id) => useQuery({ queryKey: qk.gaps(id ?? ''), queryFn: () => api.gaps(id ?? ''), enabled: !!id });
export const useReadiness = (id: Id) =>
  useQuery({ queryKey: qk.readiness(id ?? ''), queryFn: () => api.readiness(id ?? ''), enabled: !!id });
export const useApprovals = (id: Id) =>
  useQuery({ queryKey: qk.approvals(id ?? ''), queryFn: () => api.approvals(id ?? ''), enabled: !!id });
export const useApproval = (approvalId: Id) =>
  useQuery({ queryKey: qk.approval(approvalId ?? ''), queryFn: () => api.approval(approvalId ?? ''), enabled: !!approvalId });
export const useEmails = (id: Id) => useQuery({ queryKey: qk.emails(id ?? ''), queryFn: () => api.emails(id ?? ''), enabled: !!id });
export const useCalendar = (id: Id) =>
  useQuery({ queryKey: qk.calendar(id ?? ''), queryFn: () => api.calendar(id ?? ''), enabled: !!id });

function appendChat(list: ChatMessageDTO[] | undefined, message: ChatMessageDTO): ChatMessageDTO[] | undefined {
  if (!list) return list;
  return list.some((m) => m.id === message.id) ? list : [...list, message];
}

export function useSendChat(id: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.sendChat(id ?? '', text),
    onSuccess: (message) => qc.setQueryData<ChatMessageDTO[]>(qk.chat(id ?? ''), (prev) => appendChat(prev, message)),
  });
}

export function useSendVoiceNote(id: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ audio, filename }: { audio: Blob; filename: string }) => api.sendVoiceNote(id ?? '', audio, filename),
    onSuccess: (message) => qc.setQueryData<ChatMessageDTO[]>(qk.chat(id ?? ''), (prev) => appendChat(prev, message)),
  });
}

export function useAnswerQuestion(id: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: string }) => api.answerQuestion(questionId, answer),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.questions(id ?? '') });
      void qc.invalidateQueries({ queryKey: qk.truth(id ?? '') });
    },
  });
}

export function useAddShortlist(id: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ShortlistInput) => api.addShortlist(id ?? '', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.shortlist(id ?? '') }),
  });
}

export function useSetRoute(id: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (route: Parameters<typeof api.setRoute>[1]) => api.setRoute(id ?? '', route),
    onSuccess: (applicant) => qc.setQueryData(qk.applicant(applicant.id), applicant),
  });
}

// ---------- staff ----------

export const usePipeline = () => useQuery({ queryKey: qk.pipeline, queryFn: () => api.pipeline() });
export const useQueue = () => useQuery({ queryKey: qk.queue, queryFn: () => api.queue(), refetchInterval: 30_000 });
export const useBrief = (id: Id) => useQuery({ queryKey: qk.brief(id ?? ''), queryFn: () => api.brief(id ?? ''), enabled: !!id });
export const useOpenings = () => useQuery({ queryKey: qk.openings, queryFn: () => api.openings() });
export const useMatches = (openingId: Id) =>
  useQuery({ queryKey: qk.matches(openingId ?? ''), queryFn: () => api.matches(openingId ?? ''), enabled: !!openingId });
export const useBatchPlan = () => useQuery({ queryKey: qk.batch, queryFn: () => api.batchPlanner() });
export const useBroadcasts = () => useQuery({ queryKey: qk.broadcasts, queryFn: () => api.broadcasts() });
export const useTrace = (applicantId?: string, limit = 300) =>
  useQuery({ queryKey: qk.trace(applicantId), queryFn: () => api.trace({ applicantId, limit }) });
export const useMailTracker = (applicantId?: string) =>
  useQuery({ queryKey: qk.mail(applicantId), queryFn: () => api.mailTracker({ applicantId, limit: 100 }), refetchInterval: 15_000 });
export const useMailDetail = (mailpitId: Id) =>
  useQuery({ queryKey: qk.mailDetail(mailpitId ?? ''), queryFn: () => api.mailTrackerDetail(mailpitId ?? ''), enabled: !!mailpitId });
export const useStats = () => useQuery({ queryKey: qk.stats, queryFn: () => api.stats(), refetchInterval: 30_000 });
export const useSystemStatus = () =>
  useQuery({ queryKey: qk.system, queryFn: () => api.systemStatus(), refetchInterval: 30_000, retry: false });
