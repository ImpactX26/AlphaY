/**
 * Mock or live?
 * Order: `?mock=1|0` in the URL (sticky) → localStorage override → VITE_MOCK → probe GET /api/system/status.
 * Mock is the default until the API answers.
 */
export type ApiMode = 'live' | 'mock';

const MODE_KEY = 'educaro.mode';

function readOverride(): ApiMode | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('mock');
    if (q === '1' || q === '0') {
      const mode: ApiMode = q === '1' ? 'mock' : 'live';
      localStorage.setItem(MODE_KEY, mode);
      params.delete('mock');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
      return mode;
    }
    if (q === 'auto') {
      localStorage.removeItem(MODE_KEY);
      return null;
    }
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === 'mock' || stored === 'live') return stored;
  } catch {
    /* storage blocked: fall through */
  }
  return null;
}

export async function probeLive(timeoutMs = 1800): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('/api/system/status', { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return false;
    const body: unknown = await res.json();
    return typeof body === 'object' && body !== null && 'llm' in body;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function resolveMode(): Promise<{ mode: ApiMode; reason: 'override' | 'env' | 'probe' }> {
  const override = readOverride();
  if (override) return { mode: override, reason: 'override' };
  const env = import.meta.env.VITE_MOCK as string | undefined;
  if (env === '1' || env === 'true') return { mode: 'mock', reason: 'env' };
  if (env === '0' || env === 'false') return { mode: 'live', reason: 'env' };
  return { mode: (await probeLive()) ? 'live' : 'mock', reason: 'probe' };
}

/** Pin a mode (or clear the pin with null) and reload. */
export function switchMode(mode: ApiMode | null) {
  try {
    if (mode) localStorage.setItem(MODE_KEY, mode);
    else localStorage.removeItem(MODE_KEY);
  } catch {
    /* ignore */
  }
  window.location.assign('/');
}

// ---------- token storage (separate per mode so a mock token never hits the real API) ----------
let currentMode: ApiMode = 'mock';
export function setActiveMode(mode: ApiMode) {
  currentMode = mode;
}
export function activeMode(): ApiMode {
  return currentMode;
}
const tokenKey = () => `educaro.token.${currentMode}`;

export function getToken(): string | null {
  try {
    return localStorage.getItem(tokenKey());
  } catch {
    return null;
  }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(tokenKey(), token);
    else localStorage.removeItem(tokenKey());
  } catch {
    /* ignore */
  }
}
