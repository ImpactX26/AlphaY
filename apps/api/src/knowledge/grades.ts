/**
 * Modified Bavarian formula, computed in code, never by the model:
 *   German grade = 1 + 3 × (Nmax − Nd) ÷ (Nmax − Nmin)
 * Nmax = best possible grade, Nmin = lowest pass mark, Nd = the applicant's grade.
 * The result is clamped to 1.0 to 4.0 and truncated to one decimal (German practice).
 */
export interface GradeConversion {
  german: number;
  formula: string;
  nmax: number;
  nmin: number;
  nd: number;
}

export function bavarian(nd: number, nmax: number, nmin: number): GradeConversion {
  const raw = 1 + (3 * (nmax - nd)) / (nmax - nmin);
  const german = Math.min(4, Math.max(1, Math.floor(raw * 10 + 1e-9) / 10));
  const fmt = (n: number) => String(Number(n.toFixed(2)));
  return {
    german,
    nmax,
    nmin,
    nd,
    formula: `1 + 3 × (${fmt(nmax)} − ${fmt(nd)}) ÷ (${fmt(nmax)} − ${fmt(nmin)}) = ${german.toFixed(1)}`,
  };
}

/**
 * Parse an Indian grade string into numbers the formula can use.
 * "8.2 CGPA", "CGPA 8.2/10", "78%", "78.4 percent", "First Class with Distinction (76%)".
 * Default pass marks: 10-point CGPA scale passes at 4 (spec example), percentages pass at 40.
 */
export function parseIndianGrade(
  raw: string | null | undefined,
  scaleMax?: number | null,
  passMin?: number | null,
): { nd: number; nmax: number; nmin: number } | null {
  if (!raw) return null;
  const s = raw.replace(',', '.');
  const pct = s.match(/(\d{2}(?:\.\d+)?)\s*(%|percent)/i);
  if (pct) return { nd: Number(pct[1]), nmax: scaleMax ?? 100, nmin: passMin ?? 40 };
  const outOf = s.match(/(\d{1,2}(?:\.\d+)?)\s*\/\s*(\d{1,3})/);
  if (outOf) {
    const max = Number(outOf[2]);
    return { nd: Number(outOf[1]), nmax: max, nmin: passMin ?? (max === 10 ? 4 : max === 4 ? 2 : max * 0.4) };
  }
  const num = s.match(/(\d{1,2}(?:\.\d+)?)/);
  if (!num) return null;
  const nd = Number(num[1]);
  if (/cgpa|sgpa|gpa|cpi/i.test(s) || nd <= 10) return { nd, nmax: scaleMax ?? 10, nmin: passMin ?? 4 };
  return { nd, nmax: scaleMax ?? 100, nmin: passMin ?? 40 };
}

export function convertIndianGrade(raw: string | null | undefined, scaleMax?: number | null, passMin?: number | null) {
  const p = parseIndianGrade(raw, scaleMax, passMin);
  return p ? bavarian(p.nd, p.nmax, p.nmin) : null;
}
