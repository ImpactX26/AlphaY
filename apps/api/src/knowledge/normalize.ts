const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/** "Jul 2021", "07/2021", "2021-07", "July 2021", "2021" -> { y, m } (m null when only a year). */
export function parseMonth(raw: string | null | undefined): { y: number; m: number | null } | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (/present|current|till date|now|ongoing/.test(s)) {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  }
  let m = s.match(/(\d{4})-(\d{1,2})/);
  if (m) return { y: +m[1], m: +m[2] };
  m = s.match(/(\d{1,2})[/.](\d{4})/);
  if (m) return { y: +m[2], m: +m[1] };
  m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return { y: +m[3], m: +m[2] };
  m = s.match(/([a-z]{3,9})\.?\s*,?\s*(\d{4})/);
  if (m && MONTHS[m[1].slice(0, 4)] !== undefined) return { y: +m[2], m: MONTHS[m[1].slice(0, 4)] };
  if (m && MONTHS[m[1].slice(0, 3)] !== undefined) return { y: +m[2], m: MONTHS[m[1].slice(0, 3)] };
  m = s.match(/\b(19|20)(\d{2})\b/);
  if (m) return { y: +(m[1] + m[2]), m: null };
  return null;
}

export function monthLabel(p: { y: number; m: number | null } | null): string {
  if (!p) return '?';
  if (p.m == null) return String(p.y);
  return `${Object.keys(MONTHS).find((k) => MONTHS[k] === p.m && k.length === 3)!.replace(/^./, (c) => c.toUpperCase())} ${p.y}`;
}

export function monthsBetween(a: { y: number; m: number | null }, b: { y: number; m: number | null }): number {
  return (b.y - a.y) * 12 + ((b.m ?? 12) - (a.m ?? 1)) + 1;
}

/** Compare two periods. Returns the gap in months between their end dates (null if unknown). */
export function endDiffMonths(endA: string | null, endB: string | null): number | null {
  const a = parseMonth(endA);
  const b = parseMonth(endB);
  if (!a || !b) return null;
  // A year-only end ("2023") means "some time in 2023": compare by year.
  if (a.m == null || b.m == null) return Math.abs(a.y - b.y) * 12;
  return Math.abs((a.y - b.y) * 12 + (a.m - b.m));
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|hospital|hospitals|inc|gmbh|llp|the|india)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/** Token overlap so "Aster Medcity" matches "Aster Medcity Hospital, Kochi". */
export function sameOrg(a: string, b: string): boolean {
  const ta = new Set(slug(a).split('_').filter((t) => t.length > 2));
  const tb = new Set(slug(b).split('_').filter((t) => t.length > 2));
  if (!ta.size || !tb.size) return false;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit / Math.min(ta.size, tb.size) >= 0.5;
}

export function normName(n: string): string {
  return n.toUpperCase().replace(/[^A-Z ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Names on Indian papers often differ: initials ("ANANYA P."), father's name, order swaps.
 * 'same' = identical tokens, 'variant' = plausibly the same person but not identical (needs affidavit),
 * 'different' = no reasonable match.
 */
export function compareNames(a: string, b: string): 'same' | 'variant' | 'different' {
  const A = normName(a).split(' ');
  const B = normName(b).split(' ');
  if (A.join(' ') === B.join(' ') || [...A].sort().join(' ') === [...B].sort().join(' ')) return 'same';
  const full = (t: string[]) => t.filter((x) => x.length > 1);
  const shared = full(A).filter((x) => B.includes(x));
  if (shared.length >= 1) return 'variant';
  return 'different';
}

export function daysUntil(date: string | Date | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

/**
 * Lowercases a title for use mid-sentence without destroying the terms inside it.
 *
 * Plain `.toLowerCase()` turned "German B1 needed, then B2" into "german b1 needed, then b2", which
 * reads as a typo in the one message an applicant is most likely to forward to someone. Only the
 * first word is touched, and only when it is not already a term that has to keep its case.
 */
const KEEP_CASE = /^(German|English|APS|IELTS|TOEFL|CGPA|B\.?Sc|B\.?Tech|GNM|Anerkennung|Ausbildung|Chancenkarte|ÖSD|TestDaF|telc|Goethe|Lebenslauf|EU|NRW)\b/;
export function midSentence(title: string): string {
  if (!title) return title;
  if (KEEP_CASE.test(title)) return title;
  return title.charAt(0).toLowerCase() + title.slice(1);
}

/**
 * Indian certificates are printed in capitals, and the value is carried straight onto a German CV.
 *
 * "GENERAL NURSING AND MIDWIFERY" on a Lebenslauf reads as shouting to the person hiring, or as a
 * bad scan — either way it costs the applicant something, for a reason that has nothing to do with
 * them. Only strings that are almost entirely uppercase are touched, and the abbreviations that
 * must stay uppercase are left alone, so "B.Sc" and "GNM" survive.
 */
const KEEP_UPPER = new Set(['GNM', 'ANM', 'BSC', 'B.SC', 'MSC', 'M.SC', 'BTECH', 'B.TECH', 'MTECH', 'M.TECH', 'BE', 'ME', 'MBA', 'BA', 'MA', 'PHD', 'APS', 'IELTS', 'TOEFL', 'CGPA', 'SGPA', 'ICU', 'ECG', 'IV', 'BLS', 'ACLS', 'OT', 'ER', 'ID', 'EU', 'NRW', 'II', 'III', 'IV', 'XII', 'X']);
const SMALL = new Set(['and', 'of', 'in', 'the', 'for', 'at', 'to', 'with', 'on']);

export function tidyCase(value: string | null | undefined): string {
  const s = (value ?? '').trim();
  if (!s) return s;
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (letters.length < 4) return s;
  const upperRatio = (s.match(/[A-Z]/g) ?? []).length / letters.length;
  if (upperRatio < 0.8) return s; // already mixed case: leave the author's choice alone
  return s
    .toLowerCase()
    .split(/(\s+|[,;/()])/)
    .map((word, i) => {
      if (!/[a-z]/.test(word)) return word;
      const bare = word.replace(/[^a-z.]/gi, '');
      if (KEEP_UPPER.has(bare.toUpperCase())) return word.toUpperCase();
      if (i > 0 && SMALL.has(bare)) return word;
      return word.replace(/^([a-z])/, (c) => c.toUpperCase());
    })
    .join('');
}
