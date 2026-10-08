import type { ServerMessage } from '@educaro/shared';

type Listener = (msg: ServerMessage) => void;
const listeners = new Set<Listener>();

/** In-browser stand-in for the socket in mock mode. Same message union as the real server. */
export const mockBus = {
  emit(msg: ServerMessage): void {
    queueMicrotask(() => {
      for (const l of listeners) l(msg);
    });
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
