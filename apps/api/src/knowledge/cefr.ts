import { CEFR, type CefrLevel } from '@educaro/shared';

export function parseCefr(raw: string | null | undefined): CefrLevel | null {
  if (!raw) return null;
  const m = raw.toUpperCase().match(/\b([ABC])\s?([12])(?:\.\d)?\b/);
  if (!m) return null;
  const lvl = `${m[1]}${m[2]}` as CefrLevel;
  return (CEFR as readonly string[]).includes(lvl) ? lvl : null;
}

export function cefrIndex(l: CefrLevel | null): number {
  return l ? CEFR.indexOf(l) : -1;
}

/** True when `have` meets or exceeds `need`. */
export function meetsCefr(have: CefrLevel | null, need: CefrLevel): boolean {
  return cefrIndex(have) >= cefrIndex(need);
}

/** Steps between two levels, e.g. A2 -> B2 is 2. */
export function cefrGap(have: CefrLevel | null, need: CefrLevel): number {
  return Math.max(0, cefrIndex(need) - Math.max(cefrIndex(have), -1));
}

/** Rough IELTS band to CEFR, used only to explain a score, never to verify one. */
export function ieltsToCefr(band: number): CefrLevel {
  if (band >= 8.5) return 'C2';
  if (band >= 7) return 'C1';
  if (band >= 5.5) return 'B2';
  if (band >= 4) return 'B1';
  return 'A2';
}

/** Educaro online batches: A1 to B1 takes about 9 months (educaro.de/india), so about 13 weeks per level. */
export const WEEKS_PER_LEVEL = 13;
