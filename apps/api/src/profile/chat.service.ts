import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { ChatMessageDTO } from '@educaro/shared';
import { db, schema } from '../db/db';
import { AgentEventsService } from '../agent/events.service';
import { BusService } from '../common/bus.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

type Row = typeof schema.chatMessages.$inferSelect;

export const toChatDTO = (m: Row): ChatMessageDTO => ({
  id: m.id,
  applicantId: m.applicantId,
  author: m.author,
  channel: m.channel,
  text: m.text,
  createdAt: m.createdAt.toISOString(),
});

/** One conversation per applicant, whatever the channel. A message anywhere wakes the same loop. */
@Injectable()
export class ChatService {
  constructor(
    private readonly rt: RealtimeGateway,
    private readonly events: AgentEventsService,
    private readonly bus: BusService,
  ) {}

  list(applicantId: string) {
    return db.query.chatMessages.findMany({ where: eq(schema.chatMessages.applicantId, applicantId), orderBy: asc(schema.chatMessages.createdAt) });
  }

  private async add(applicantId: string, author: Row['author'], channel: Row['channel'], text: string): Promise<Row> {
    const [row] = await db.insert(schema.chatMessages).values({ applicantId, author, channel, text: text.slice(0, 4000) }).returning();
    this.rt.toBoth(applicantId, { type: 'chat', applicantId, message: toChatDTO(row) });
    return row;
  }

  async applicantSays(applicantId: string, text: string, channel: Row['channel'] = 'web'): Promise<Row> {
    const row = await this.add(applicantId, 'applicant', channel, text);
    await this.events.wake(applicantId, { type: channel === 'discord' ? 'discord' : channel === 'email' ? 'email_reply' : 'chat', detail: { text, channel } });
    return row;
  }

  async agentSays(applicantId: string, text: string, channel: Row['channel'] = 'web'): Promise<Row> {
    const row = await this.add(applicantId, 'agent', channel, text);
    if (channel !== 'web') this.bus.emit('agent_message', { applicantId, text, channel });
    return row;
  }

  system(applicantId: string, text: string) {
    return this.add(applicantId, 'system', 'web', text);
  }

  staffSays(applicantId: string, text: string) {
    return this.add(applicantId, 'staff', 'web', text);
  }
}
