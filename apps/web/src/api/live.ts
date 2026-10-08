/**
 * Applies socket messages to the React Query cache, and keeps a tiny store for agent status
 * (the "agent is working…" indicator) and pipeline highlights.
 */
import type { QueryClient } from '@tanstack/react-query';
import type { ChatMessageDTO, PipelineCardDTO, Screen, ServerMessage, TraceDTO } from '@educaro/shared';
import { useSyncExternalStore } from 'react';
import { qk, sectionsFor } from './keys';

// ---------- agent status store ----------
export interface AgentState {
  status: 'idle' | 'thinking' | 'working';
  detail?: string;
  at: number;
  /** Recent details, newest first (max 6). */
  recent: string[];
}
const IDLE: AgentState = { status: 'idle', at: 0, recent: [] };
const agentStates = new Map<string, AgentState>();
const agentListeners = new Set<() => void>();

function emitAgent() {
  for (const l of agentListeners) l();
}
export function setAgentStatus(applicantId: string, status: AgentState['status'], detail?: string) {
  const prev = agentStates.get(applicantId) ?? IDLE;
  const recent = detail && detail !== prev.recent[0] ? [detail, ...prev.recent].slice(0, 6) : prev.recent;
  agentStates.set(applicantId, { status, detail: detail ?? (status === 'idle' ? undefined : prev.detail), at: Date.now(), recent });
  emitAgent();
}
function subscribeAgent(cb: () => void) {
  agentListeners.add(cb);
  return () => {
    agentListeners.delete(cb);
  };
}
export function useAgentStatus(applicantId: string | null | undefined): AgentState {
  return useSyncExternalStore(subscribeAgent, () => (applicantId ? (agentStates.get(applicantId) ?? IDLE) : IDLE));
}

// ---------- pipeline highlight store (cards flash when the agent moves them) ----------
const flashes = new Map<string, number>();
const flashListeners = new Set<() => void>();
function subscribeFlash(cb: () => void) {
  flashListeners.add(cb);
  return () => {
    flashListeners.delete(cb);
  };
}
export function usePipelineFlash(applicantId: string): number {
  return useSyncExternalStore(subscribeFlash, () => flashes.get(applicantId) ?? 0);
}

// ---------- chat arrival events (unread badge on the mobile chat button) ----------
type ChatListener = (m: ChatMessageDTO) => void;
const chatListeners = new Set<ChatListener>();
export function onChatMessage(cb: ChatListener) {
  chatListeners.add(cb);
  return () => {
    chatListeners.delete(cb);
  };
}

function prependTrace(qc: QueryClient, key: readonly unknown[], t: TraceDTO) {
  qc.setQueryData<TraceDTO[]>(key, (old) => {
    if (!old) return old;
    if (old.some((x) => x.id === t.id)) return old;
    return [t, ...old].slice(0, 800);
  });
}

export function applyServerMessage(qc: QueryClient, m: ServerMessage) {
  switch (m.type) {
    case 'screen': {
      const key = qk.applicant(m.screen.applicantId, 'screen');
      qc.setQueryData<Screen>(key, (old) => (!old || m.screen.version >= old.version ? m.screen : old));
      break;
    }
    case 'agent_status':
      setAgentStatus(m.applicantId, m.status, m.detail);
      break;
    case 'chat': {
      qc.setQueryData<ChatMessageDTO[]>(qk.applicant(m.applicantId, 'chat'), (old) => {
        if (!old) return old;
        if (old.some((x) => x.id === m.message.id)) return old;
        return [...old, m.message];
      });
      for (const l of chatListeners) l(m.message);
      break;
    }
    case 'trace': {
      const t = m.trace;
      if (t.applicantId) {
        prependTrace(qc, qk.applicant(t.applicantId, 'trace'), t);
        prependTrace(qc, qk.staff.trace(t.applicantId), t);
      }
      prependTrace(qc, qk.staff.trace(), t);
      break;
    }
    case 'pipeline': {
      qc.setQueryData<PipelineCardDTO[]>(qk.staff.pipeline, (old) =>
        old?.map((c) =>
          c.applicantId === m.applicantId
            ? { ...c, stage: m.stage, stageReason: m.reason, updatedAt: new Date().toISOString() }
            : c,
        ),
      );
      flashes.set(m.applicantId, Date.now());
      for (const l of flashListeners) l();
      void qc.invalidateQueries({ queryKey: qk.applicant(m.applicantId, 'profile') });
      void qc.invalidateQueries({ queryKey: qk.staff.pipeline });
      break;
    }
    case 'refresh': {
      const sections = sectionsFor(m.what);
      if (!sections) void qc.invalidateQueries({ queryKey: qk.applicantAll(m.applicantId) });
      else for (const s of sections) void qc.invalidateQueries({ queryKey: qk.applicant(m.applicantId, s) });
      if (m.what.some((w) => /approv|letter/i.test(w))) void qc.invalidateQueries({ queryKey: ['approval'] });
      void qc.invalidateQueries({ queryKey: qk.staff.pipeline });
      void qc.invalidateQueries({ queryKey: qk.staff.queue });
      if (m.what.some((w) => /mail|email/i.test(w))) void qc.invalidateQueries({ queryKey: qk.staff.mailAll });
      break;
    }
  }
}
