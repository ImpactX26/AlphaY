import { Injectable } from '@nestjs/common';
import type { AgentEventType } from '@educaro/shared';
import { QueueService } from '../queue/queue.service';

export interface AgentEvent {
  type: AgentEventType;
  detail?: Record<string, unknown>;
  at?: number;
}

const kEvents = (id: string) => `agent:events:${id}`;
const kScheduled = (id: string) => `agent:scheduled:${id}`;
export const kLock = (id: string) => `agent:lock:${id}`;

/**
 * Every answer, upload, email reply, Discord message or deadline wakes the agent.
 * Events are buffered per applicant and drained by one loop run, so seven uploads cause one plan, not seven.
 */
@Injectable()
export class AgentEventsService {
  constructor(private readonly q: QueueService) {}

  async wake(applicantId: string, event: AgentEvent, delayMs?: number) {
    await this.q.redis.rpush(kEvents(applicantId), JSON.stringify({ ...event, at: Date.now() }));
    await this.schedule(applicantId, delayMs ?? (event.type === 'upload' ? 2000 : 400));
  }

  async schedule(applicantId: string, delayMs = 400) {
    const fresh = await this.q.redis.set(kScheduled(applicantId), '1', 'PX', 20_000, 'NX');
    if (fresh) await this.q.add('agent', 'loop', { applicantId }, { delay: delayMs });
  }

  async drain(applicantId: string): Promise<AgentEvent[]> {
    const res = await this.q.redis.multi().lrange(kEvents(applicantId), 0, -1).del(kEvents(applicantId)).exec();
    const items = (res?.[0]?.[1] as string[] | undefined) ?? [];
    return items.map((s) => JSON.parse(s) as AgentEvent);
  }

  async pending(applicantId: string): Promise<number> {
    return this.q.redis.llen(kEvents(applicantId));
  }

  clearScheduled(applicantId: string) {
    return this.q.redis.del(kScheduled(applicantId));
  }
}
