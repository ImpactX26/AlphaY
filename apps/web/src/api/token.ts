const TOKEN_KEY = 'educaro.token';
const MOCK_KEY = 'educaro.mock';

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
 * Mock mode: VITE_MOCK=1 at build time, or switched on at runtime from the sign-in page.
 *
 * The runtime switch is deliberately **session**-scoped. It used to live in localStorage, which
 * meant one tap on the sign-in page pinned that browser to mocks permanently: `isMock` is read once
 * at module load and never re-checked, so a perfectly healthy API was ignored for good. What you
 * saw was not an error — it was the mock answering, with canned chat replies, "mock mode has no
 * transcription", and placeholder requirement tables. That is a horrible failure to debug, because
 * everything looks like it works and is simply wrong.
 *
 * A pin you set while looking at the app should last as long as you are looking at it. A new
 * session asks again, and the old permanent pin is cleared on the way past.
 */
function readMockPin(): boolean {
  try {
    // The old permanent pin is deleted, not carried over. Migrating it into the session looked
    // tidier and was worse: anybody who had ever tapped the toggle stayed on mocks without asking
    // for it again, and the only clue was a small badge next to a green "Live" dot. Mock is a thing
    // you choose now, in this tab, on purpose.
    write(MOCK_KEY, null);
    const q = new URLSearchParams(window.location.search).get('mock');
    if (q === '0') {
      sessionStorage.removeItem(MOCK_KEY);
      return false;
    }
    if (q === '1') {
      sessionStorage.setItem(MOCK_KEY, '1');
      return true;
    }
    return sessionStorage.getItem(MOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export const isMock: boolean = import.meta.env.VITE_MOCK === '1' || readMockPin();

export function setMockMode(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(MOCK_KEY, '1');
    else sessionStorage.removeItem(MOCK_KEY);
    write(MOCK_KEY, null);
  } catch {
    /* storage blocked: the choice lasts until reload */
  }
  tokenStore.set(null);
  window.location.assign('/login');
}
