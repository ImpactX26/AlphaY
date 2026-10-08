/**
 * Realtime: socket.io on the same origin (`io({ auth: { token } })`), one event name `msg`
 * carrying a ServerMessage. Staff `emit('watch', applicantId)` on the applicant detail page.
 * The mock layer provides the same interface over an in-memory bus.
 */
import type { ServerMessage } from '@educaro/shared';
import { io, type Socket } from 'socket.io-client';

export type ConnStatus = 'idle' | 'connecting' | 'online' | 'offline';
type Handler = (m: ServerMessage) => void;
type StatusHandler = (s: ConnStatus) => void;

export interface Realtime {
  connect(token: string | null): void;
  disconnect(): void;
  subscribe(handler: Handler): () => void;
  onStatus(handler: StatusHandler): () => void;
  status(): ConnStatus;
  watch(applicantId: string): void;
  unwatch(applicantId: string): void;
}

/** Shared plumbing: handler sets, status fan-out. */
export class RealtimeBase {
  protected handlers = new Set<Handler>();
  protected statusHandlers = new Set<StatusHandler>();
  protected current: ConnStatus = 'idle';
  protected watched = new Set<string>();

  subscribe(handler: Handler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
  onStatus(handler: StatusHandler) {
    this.statusHandlers.add(handler);
    handler(this.current);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }
  status() {
    return this.current;
  }
  protected setStatus(s: ConnStatus) {
    this.current = s;
    for (const h of this.statusHandlers) h(s);
  }
  protected dispatch(m: ServerMessage) {
    for (const h of this.handlers) {
      try {
        h(m);
      } catch (err) {
        console.error('[realtime] handler failed', err);
      }
    }
  }
}

function isServerMessage(x: unknown): x is ServerMessage {
  return typeof x === 'object' && x !== null && typeof (x as { type?: unknown }).type === 'string';
}

export class SocketRealtime extends RealtimeBase implements Realtime {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(token: string | null) {
    if (token === this.token && this.socket) return;
    this.disconnect();
    this.token = token;
    if (!token) return;
    this.setStatus('connecting');
    const socket = io({ auth: { token }, transports: ['websocket', 'polling'], reconnectionDelayMax: 4000 });
    this.socket = socket;
    socket.on('connect', () => {
      this.setStatus('online');
      for (const id of this.watched) socket.emit('watch', id);
    });
    socket.on('disconnect', () => this.setStatus('offline'));
    socket.on('connect_error', () => this.setStatus('offline'));
    socket.on('msg', (m: unknown) => {
      if (isServerMessage(m)) this.dispatch(m);
    });
  }
  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.token = null;
    this.setStatus('idle');
  }
  watch(applicantId: string) {
    this.watched.add(applicantId);
    if (this.socket?.connected) this.socket.emit('watch', applicantId);
  }
  unwatch(applicantId: string) {
    this.watched.delete(applicantId);
  }
}

export let realtime!: Realtime;
export function installRealtime(impl: Realtime) {
  realtime = impl;
}
