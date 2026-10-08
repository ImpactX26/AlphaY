/**
 * Mock mode keeps its state in memory, so a page reload would throw away the demo.
 * This mirrors it into sessionStorage: a reload resumes where the presenter was, and
 * closing the tab starts clean. Bump VERSION whenever the fixture shape changes.
 */
const KEY = 'educaro.mock.state';
const VERSION = 1;

export interface MockSnapshot {
  version: number;
  states: Record<string, unknown>;
  openings: unknown;
  matches: Record<string, unknown>;
  broadcasts: unknown;
  bookings: Record<string, string>;
  globalTrace: unknown;
  openaiSpent: number;
  seq: number;
}

export function loadSnapshot(): MockSnapshot | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as MockSnapshot;
    return snapshot.version === VERSION ? snapshot : null;
  } catch {
    return null;
  }
}

let pending: ReturnType<typeof setTimeout> | null = null;

/** Debounced: the agent loop touches state many times per second. */
export function saveSnapshot(build: () => Omit<MockSnapshot, 'version'>): void {
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ version: VERSION, ...build() }));
    } catch {
      /* storage full or blocked: the demo still runs, it just won't survive a reload */
    }
  }, 400);
}

export function clearSnapshot(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
