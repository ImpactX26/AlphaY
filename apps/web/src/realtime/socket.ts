import type { ServerMessage } from '@educaro/shared';
import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import { mockBus } from '../api/mockBus';
import { isMock } from '../api/token';

type Listener = (msg: ServerMessage) => void;
export type ConnectionState = 'connecting' | 'live' | 'offline';

const listeners = new Set<Listener>();
const stateListeners = new Set<() => void>();
const watched = new Map<string, number>();
let socket: Socket | null = null;
let stopMock: (() => void) | null = null;
let connection: ConnectionState = 'offline';

function setConnection(next: ConnectionState): void {
  if (connection === next) return;
  connection = next;
  for (const l of stateListeners) l();
}

function dispatch(msg: ServerMessage): void {
  for (const l of listeners) l(msg);
}

/** One socket for the whole app: `io({ auth: { token } })`, event `msg` carries a ServerMessage. */
export function connectRealtime(token: string | null): void {
  disconnectRealtime();
  if (!token) return;
  if (isMock) {
    stopMock = mockBus.subscribe(dispatch);
    setConnection('live');
    return;
  }
  setConnection('connecting');
  const s = io({ auth: { token }, transports: ['websocket', 'polling'], reconnectionDelayMax: 5000 });
  s.on('connect', () => {
    setConnection('live');
    for (const id of watched.keys()) s.emit('watch', id);
  });
  s.on('disconnect', () => setConnection('connecting'));
  s.on('connect_error', () => setConnection('offline'));
  s.on('msg', (msg: ServerMessage) => dispatch(msg));
  socket = s;
}

export function disconnectRealtime(): void {
  stopMock?.();
  stopMock = null;
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  setConnection('offline');
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Staff: join an applicant's room to get their live screen, chat and trace. */
export function watchApplicant(applicantId: string): () => void {
  watched.set(applicantId, (watched.get(applicantId) ?? 0) + 1);
  if (socket?.connected) socket.emit('watch', applicantId);
  return () => {
    const n = (watched.get(applicantId) ?? 1) - 1;
    if (n <= 0) watched.delete(applicantId);
    else watched.set(applicantId, n);
  };
}

function subscribeConnection(cb: () => void): () => void {
  stateListeners.add(cb);
  return () => {
    stateListeners.delete(cb);
  };
}

export function useConnection(): ConnectionState {
  return useSyncExternalStore(subscribeConnection, () => connection);
}
