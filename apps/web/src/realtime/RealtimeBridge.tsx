import type { ChatMessageDTO, PipelineCardDTO, Screen, TraceDTO } from '@educaro/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { keysForRefresh, qk } from '../api/queries';
import { setAgentActivity } from './agentStatus';
import { subscribe } from './socket';

const prependTrace = (prev: TraceDTO[] | undefined, t: TraceDTO) => (prev && !prev.some((x) => x.id === t.id) ? [t, ...prev] : prev);

/** Turns socket messages into query-cache updates, so every screen stays live without its own wiring. */
export function RealtimeBridge(): null {
  const qc = useQueryClient();
  useEffect(
    () =>
      subscribe((msg) => {
        switch (msg.type) {
          case 'screen': {
            const key = qk.screen(msg.screen.applicantId);
            const prev = qc.getQueryData<Screen>(key);
            if (!prev || msg.screen.version >= prev.version) qc.setQueryData(key, msg.screen);
            break;
          }
          case 'chat':
            qc.setQueryData<ChatMessageDTO[]>(qk.chat(msg.applicantId), (prev) =>
              prev && !prev.some((m) => m.id === msg.message.id) ? [...prev, msg.message] : prev,
            );
            break;
          case 'agent_status':
            setAgentActivity(msg.applicantId, msg.status, msg.detail);
            break;
          case 'trace':
            qc.setQueryData<TraceDTO[]>(qk.trace(), (prev) => prependTrace(prev, msg.trace));
            if (msg.trace.applicantId) qc.setQueryData<TraceDTO[]>(qk.trace(msg.trace.applicantId), (prev) => prependTrace(prev, msg.trace));
            break;
          case 'pipeline':
            qc.setQueryData<PipelineCardDTO[]>(qk.pipeline, (prev) =>
              prev?.map((c) =>
                c.applicantId === msg.applicantId ? { ...c, stage: msg.stage, stageReason: msg.reason, updatedAt: new Date().toISOString() } : c,
              ),
            );
            void qc.invalidateQueries({ queryKey: qk.applicant(msg.applicantId) });
            break;
          case 'refresh':
            for (const what of msg.what.length ? msg.what : ['*'])
              for (const queryKey of keysForRefresh(msg.applicantId, what)) void qc.invalidateQueries({ queryKey });
            break;
        }
      }),
    [qc],
  );
  return null;
}
