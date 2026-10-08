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

/** Mock mode: VITE_MOCK=1 at build time, or switched on at runtime from the sign-in page. */
export const isMock: boolean = import.meta.env.VITE_MOCK === '1' || read(MOCK_KEY) === '1';

export function setMockMode(on: boolean): void {
  write(MOCK_KEY, on ? '1' : null);
  tokenStore.set(null);
  window.location.assign('/login');
}
