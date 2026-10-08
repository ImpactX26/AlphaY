const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const dateShortFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const weekdayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' });

function toDate(v: string | number | Date | null | undefined): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(v: string | null | undefined): string {
  const d = toDate(v);
  return d ? dateFmt.format(d) : (v ?? '');
}
export function fmtDateShort(v: string | null | undefined): string {
  const d = toDate(v);
  return d ? dateShortFmt.format(d) : (v ?? '');
}
export function fmtTime(v: string | null | undefined): string {
  const d = toDate(v);
  return d ? timeFmt.format(d) : '';
}
export function fmtDateTime(v: string | null | undefined): string {
  const d = toDate(v);
  return d ? `${weekdayFmt.format(d)}, ${timeFmt.format(d)}` : (v ?? '');
}
export function fmtWeekday(v: string | null | undefined): string {
  const d = toDate(v);
  return d ? weekdayFmt.format(d) : (v ?? '');
}
/** "2027-03" or an ISO date → "Mar 2027". Leaves other strings alone. */
export function fmtMonth(v: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : toDate(v);
  return d ? monthFmt.format(d) : v;
}

export function relTime(v: string | null | undefined, now = Date.now()): string {
  const d = toDate(v);
  if (!d) return '';
  const diff = Math.round((d.getTime() - now) / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return fmtDate(v);
}

export function daysUntil(v: string | null | undefined, now = Date.now()): number | null {
  const d = toDate(v);
  if (!d) return null;
  return Math.ceil((d.getTime() - now) / 86400000);
}

const eur = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function fmtEUR(n: number, cents = false): string {
  return (cents ? eur2 : eur).format(n);
}
export function fmtUSD(n: number): string {
  return `$${n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2)}`;
}
export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Accept 0–1 fractions or 0–100 percentages; return 0–100. */
export function pct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const p = v > 0 && v <= 1 ? v * 100 : v;
  return Math.max(0, Math.min(100, Math.round(p)));
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const a = parts[0]?.[0] ?? '';
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '');
  return (a + b).toUpperCase();
}

export function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? '';
}

export function hostOf(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
