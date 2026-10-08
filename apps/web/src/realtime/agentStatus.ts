import { useSyncExternalStore } from 'react';

export interface AgentActivity {
  status: 'idle' | 'thinking' | 'working';
  detail?: string;
  at: number;
}

const IDLE: AgentActivity = { status: 'idle', at: 0 };
const byApplicant = new Map<string, AgentActivity>();
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function notify(): void {
  for (const l of listeners) l();
}

/** Set from `agent_status` socket messages. A busy status with no follow-up fades after 45 s. */
export function setAgentActivity(applicantId: string, status: AgentActivity['status'], detail?: string): void {
  byApplicant.set(applicantId, { status, detail, at: Date.now() });
  clearTimeout(timers.get(applicantId));
  if (status !== 'idle') timers.set(applicantId, setTimeout(() => setAgentActivity(applicantId, 'idle'), 45_000));
  notify();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useAgentActivity(applicantId: string | null | undefined): AgentActivity {
  return useSyncExternalStore(subscribe, () => (applicantId ? (byApplicant.get(applicantId) ?? IDLE) : IDLE));
}
