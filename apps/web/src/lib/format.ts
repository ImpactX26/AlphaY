const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const weekdayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' });
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const parse = (iso: string): Date | null => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDate = (iso: string | null | undefined): string => (iso && parse(iso) ? dateFmt.format(parse(iso) as Date) : '');
export const formatShortDate = (iso: string): string => (parse(iso) ? shortDateFmt.format(parse(iso) as Date) : iso);
export const formatDateTime = (iso: string): string => (parse(iso) ? dateTimeFmt.format(parse(iso) as Date) : iso);
export const formatTime = (iso: string): string => (parse(iso) ? timeFmt.format(parse(iso) as Date) : '');
export const formatWeekday = (iso: string): string => (parse(iso) ? weekdayFmt.format(parse(iso) as Date) : iso);
export const formatMonth = (isoMonth: string): string => {
  const d = parse(isoMonth.length === 7 ? `${isoMonth}-01T00:00:00Z` : isoMonth);
  return d ? monthFmt.format(d) : isoMonth;
};

export function relativeTime(iso: string, now = Date.now()): string {
  const d = parse(iso);
  if (!d) return '';
  const s = Math.round((d.getTime() - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86_400 * 30) return rtf.format(Math.round(s / 86_400), 'day');
  return formatDate(iso);
}

/** Whole days from now until a date (negative once it has passed). */
export function daysLeft(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = parse(iso.length === 10 ? `${iso}T23:59:59` : iso);
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

export function formatMoney(amount: number, currency = 'EUR'): string {
  const cents = Math.abs(amount % 1) > 0.001;
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency, minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }).format(amount);
}

export function formatUsd(amount: number): string {
  if (amount === 0) return '$0';
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase();
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const firstName = (name: string | null | undefined): string => (name ?? '').trim().split(/\s+/)[0] ?? '';
