import clsx from 'clsx';
import { ExternalLink as ExternalIcon, type LucideIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { daysLeft, formatDate, initials } from '../lib/format';

export function Meter({ label, value, className }: { label: string; value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={clsx('grid grid-cols-[96px_minmax(0,1fr)_40px] items-center gap-2.5 text-[13px]', className)}>
      <span className="truncate">{label}</span>
      <span className="bar" role="meter" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
        <i className={clsx(v < 50 && 'lo', v >= 100 && 'ok')} style={{ '--v': `${v}%` } as CSSProperties} />
      </span>
      <span className="num text-right text-muted">{v}%</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action, className }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex flex-col items-start gap-2 rounded-lg border border-dashed border-line px-5 py-6', className)}>
      {Icon ? <Icon size={22} className="text-muted" aria-hidden /> : null}
      <p className="display text-[16px] font-bold">{title}</p>
      {children ? <div className="max-w-prose text-[14px] text-muted">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * Decorative: the person's name is always next to it, or in the control's label.
 * The initials are drawn with CSS so they never reach the accessibility tree and
 * never compete with the real label of a button wrapping this.
 */
export function Avatar({ name, tone = 'applicant', size = 32 }: { name: string; tone?: 'applicant' | 'agent' | 'staff' | 'outside'; size?: number }) {
  const bg = { applicant: 'var(--applicant)', agent: 'var(--agent)', staff: 'var(--staff)', outside: 'var(--outside)' }[tone];
  return (
    <span
      aria-hidden
      data-initials={initials(name)}
      className="avatar grid flex-none place-items-center rounded-full font-display font-black text-surface"
      style={{ width: size, height: size, background: bg, fontSize: Math.round(size * 0.38) }}
    />
  );
}

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={clsx('inline-flex items-center gap-1 underline-offset-2 hover:underline', className)}>
      {children}
      <ExternalIcon size={12} aria-hidden className="flex-none opacity-70" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} aria-hidden />;
}

/** Days to a deadline, coloured by urgency. Counted in code from the date. */
export function Countdown({ date, label, days: given }: { date: string | null; label?: string; days?: number | null }) {
  const days = date ? daysLeft(date) : (given ?? null);
  if (days === null) return <span className="text-muted">{label ?? 'Date to be confirmed'}</span>;
  const tone = days < 0 ? 'text-muted' : days <= 14 ? 'text-bad' : days <= 45 ? 'text-warn' : 'text-ink';
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span className={clsx('display num text-[26px] font-black leading-none', tone)}>{days < 0 ? 'Passed' : days}</span>
      {days >= 0 ? <span className="text-[13px] text-muted">{days === 1 ? 'day left' : 'days left'}</span> : null}
      {date ? <span className="text-[13px] text-muted">· {formatDate(date)}</span> : null}
    </span>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx('mb-4 flex items-end justify-between gap-3', className)}>
      <h2 className="display text-[20px] font-bold leading-tight tracking-[-0.01em]">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 max-w-2xl">
        <h1 className="display text-[28px] font-black leading-[1.1] sm:text-[32px]">{title}</h1>
        {children ? <p className="mt-2 text-[15px] text-muted">{children}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
