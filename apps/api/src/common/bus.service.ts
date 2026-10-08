import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export interface BusEvents {
  agent_message: { applicantId: string; text: string; channel: 'web' | 'email' | 'discord' };
  notify: { applicantId: string; title: string; text: string; ics?: string; channels?: ('email' | 'discord')[] };
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
