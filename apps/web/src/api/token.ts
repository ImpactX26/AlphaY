const TOKEN_KEY = 'educaro.token';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the session lasts until reload */
  }
}

let memoryToken: string | null = read(TOKEN_KEY);

export const tokenStore = {
  get(): string | null {
    return memoryToken;
  },
  set(token: string | null): void {
    memoryToken = token;
    write(TOKEN_KEY, token);
  },
};

/**
 * Mock mode is gone.
 *
 * It existed so the frontend could be built before the API had any endpoints, and it did that job.
 * After that it cost more than it was worth: three separate times this build was reported broken
 * when the screen was simply the mock layer answering — a new applicant that saved nothing, a video
 * that was never transcribed, a chat that replied with canned text. Every one of those looked like
 * a working product and was not.
 *
 * `isMock` stays exported as `false` so nothing importing it has to change, and `setMockMode` is a
 * no-op. The real API runs with no keys and no network via `npm run sandbox`, which is the honest
 * version of what mock mode was for.
 */
export const isMock = false;

export function setMockMode(_on: boolean): void {
  /* mock mode no longer exists; the sandbox replaces it */
}
