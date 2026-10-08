/**
 * Exchange rates, from the Frankfurter API (European Central Bank reference rates). Free, no key.
 *
 * The whole plan is quoted in euro and every decision about it is made in rupees. "EUR 11,904 for
 * the blocked account" is a number somebody has to take to a bank manager, a father, or a lender,
 * and they will not do that arithmetic in their head at a rate they had to look up. A hardcoded
 * 92 was what the finance block used, which is both stale and silently wrong by a few percent —
 * about forty thousand rupees on the blocked account alone.
 *
 * Cached for a day: ECB publishes once a working day, so asking more often is pointless, and a
 * network failure must never take the money page down. A stale rate is labelled as stale rather
 * than passed off as live, because the one thing worse than an old number is an old number
 * presented as today's.
 */

export type Currency = 'EUR' | 'INR' | 'USD' | 'GBP' | 'CHF' | 'CAD' | 'AUD' | 'SGD';

export const CURRENCIES: { code: Currency; label: string; symbol: string }[] = [
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'INR', label: 'Indian rupee', symbol: '₹' },
  { code: 'USD', label: 'US dollar', symbol: '$' },
  { code: 'GBP', label: 'Pound sterling', symbol: '£' },
  // No AED: the ECB does not publish a dirham reference rate, and a currency we cannot price is
  // worse than one we do not offer — it comes back looking converted and is not.
  { code: 'CHF', label: 'Swiss franc', symbol: 'CHF ' },
  { code: 'CAD', label: 'Canadian dollar', symbol: 'C$' },
  { code: 'AUD', label: 'Australian dollar', symbol: 'A$' },
  { code: 'SGD', label: 'Singapore dollar', symbol: 'S$' },
];

export interface Rates {
  base: 'EUR';
  /** Units of each currency per one euro. */
  rates: Record<string, number>;
  /** The day the rates are for, as published. */
  date: string;
  live: boolean;
  source: string;
}

/**
 * The fallback.
 *
 * Roughly where the rates sat when this was written. Present so the money page works on a
 * conference network with no internet, and always flagged `live: false` so nothing claims these are
 * today's figures.
 */
const FALLBACK: Rates = {
  base: 'EUR',
  rates: { EUR: 1, INR: 108.3, USD: 1.12, GBP: 0.85, CHF: 0.93, CAD: 1.52, AUD: 1.69, SGD: 1.44 },
  date: '2026-10-01',
  live: false,
  source: 'Educaro reference rates (the live feed was unreachable)',
};

const DAY = 24 * 60 * 60 * 1000;
let cached: { at: number; rates: Rates } | null = null;

export async function fetchRates(): Promise<Rates> {
  if (cached && Date.now() - cached.at < DAY) return cached.rates;

  const symbols = CURRENCIES.filter((c) => c.code !== 'EUR').map((c) => c.code).join(',');
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=EUR&to=${symbols}`, {
      signal: AbortSignal.timeout(6_000),
      headers: { 'User-Agent': 'Educaro/1.0 (migration planning)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { date: string; rates: Record<string, number> };
    if (!body?.rates?.INR) throw new Error('no rates in the response');

    const rates: Rates = {
      base: 'EUR',
      rates: { EUR: 1, ...body.rates },
      date: body.date,
      live: true,
      source: 'European Central Bank reference rates, via frankfurter.app',
    };
    cached = { at: Date.now(), rates };
    return rates;
  } catch {
    // Keep serving the last good answer if we ever had one; it beats the constant.
    if (cached) return { ...cached.rates, live: false, source: `${cached.rates.source} (last fetched rate, the feed is unreachable now)` };
    return FALLBACK;
  }
}

/**
 * Convert from euro into whatever they chose to read it in.
 *
 * A missing rate returns null rather than the euro amount. Falling back to 1.0 made EUR 11,904 come
 * back as "AED 11,904", which looks converted, is not, and is wrong by a factor of four — the kind
 * of number somebody takes to a bank.
 */
export function convert(amountEur: number, to: Currency, rates: Rates): number | null {
  const r = rates.rates[to];
  return typeof r === 'number' && Number.isFinite(r) ? amountEur * r : null;
}

/**
 * Money as a person writes it.
 *
 * Indian grouping for rupees — 11,90,400 rather than 1,190,400 — because the whole point of the
 * conversion is that the figure can be read aloud to somebody at home, and a Western-grouped lakh
 * is a number Indian readers have to stop and decode.
 */
export function formatMoney(amount: number | null, code: Currency): string {
  if (amount === null) return '—';
  const symbol = CURRENCIES.find((c) => c.code === code)?.symbol ?? '';
  const rounded = Math.round(amount);
  const grouped = code === 'INR' ? rounded.toLocaleString('en-IN') : rounded.toLocaleString('en-GB');
  return `${symbol}${grouped}`;
}
