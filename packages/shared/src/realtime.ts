import type { Screen } from './screen';
import type { TraceDTO, PipelineStage } from './domain';

/** Messages pushed over the socket. Applicants join `applicant:<id>`, staff join `staff`. */
export type ServerMessage =
  | { type: 'screen'; screen: Screen }
  | { type: 'agent_status'; applicantId: string; status: 'idle' | 'thinking' | 'working'; detail?: string }
  | { type: 'chat'; applicantId: string; message: ChatMessageDTO }
  | { type: 'trace'; trace: TraceDTO }
  | { type: 'pipeline'; applicantId: string; stage: PipelineStage; reason: string }
  | { type: 'refresh'; applicantId: string; what: string[] };

export interface ChatMessageDTO {
  id: string;
  applicantId: string;
  author: 'applicant' | 'agent' | 'staff' | 'system';
  channel: 'web' | 'email' | 'discord';
  text: string;
  createdAt: string;
}
