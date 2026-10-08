import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export interface BusEvents {
  agent_message: { applicantId: string; text: string; channel: 'web' | 'email' | 'discord' };
  notify: { applicantId: string; title: string; text: string; ics?: string; channels?: ('email' | 'discord')[] };
  /** A post in the cohort thread that should be mirrored into the Discord channel. */
  community_post: { id: string; channel: string; author: string; text: string; replyToDiscordId?: string | null };
  /**
   * Somebody asked somebody else to share a flat or a flight.
   *
   * Separate from `notify` because this one needs an answer, and an invitation you reply to by
   * opening another app is an invitation that expires unanswered. Discord turns it into two
   * buttons; anywhere else it degrades to the text.
   */
  group_invite: { applicantId: string; groupId: string; from: string; title: string; text: string };
}

/** In-process bus so chat, mail and Discord can talk without import cycles. */
@Injectable()
export class BusService {
  private readonly ee = new EventEmitter();

  emit<K extends keyof BusEvents>(name: K, payload: BusEvents[K]) {
    this.ee.emit(name, payload);
  }

  on<K extends keyof BusEvents>(name: K, fn: (p: BusEvents[K]) => void | Promise<void>) {
    this.ee.on(name, (p) => {
      Promise.resolve(fn(p)).catch(() => undefined);
    });
  }
}
