import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { initials, pct } from '@/lib/format';

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return <Loader2 className={clsx('anim-spin size-4', className)} aria-label={label} role="status" />;
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      <svg viewBox="0 0 64 64" className="size-7 flex-none" aria-hidden>
        <rect width="64" height="64" rx="14" fill="var(--ink)" />
        <path d="M20 18h24v6H27v5h15v6H27v5h17v6H20z" fill="var(--bg)" />
        <circle cx="48" cy="46" r="5" fill="var(--applicant)" />
      </svg>
      {!compact && <span className="font-display text-[17px] font-extrabold tracking-tight">Educaro</span>}
    </span>
  );
}

export function Avatar({
  name,
  size = 32,
  color,
  className,
}: {
  name: string | null | undefined;
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={clsx('avatar', className)}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)), ['--ac' as string]: color } as CSSProperties}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Meter({
  label,
  value,
  low = 50,
  className,
  labelWidth = 92,
}: {
  label: string;
  value: number;
  low?: number;
  className?: string;
  labelWidth?: number;
}) {
  const v = pct(value);
  const color = v < low ? 'var(--warn)' : v >= 90 ? 'var(--ok)' : 'var(--ink)';
  return (
    <div
      className={clsx('grid items-center gap-2 text-[13px]', className)}
      style={{ gridTemplateColumns: `${labelWidth}px minmax(0,1fr) 40px` }}
    >
      <span className="truncate">{label}</span>
      <span
        className="bar"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
      >
        <i style={{ ['--v' as string]: `${v}%`, ['--bc' as string]: color } as CSSProperties} />
      </span>
      <span className="text-right tabular-nums">{v}%</span>
    </div>
  );
}

/** Small ring for an overall percentage. */
export function Ring({ value, size = 64, stroke = 7, color }: { value: number; size?: number; stroke?: number; color?: string }) {
  const v = pct(value);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-none -rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color ?? (v >= 90 ? 'var(--ok)' : v < 50 ? 'var(--warn)' : 'var(--ink)')}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v / 100)}
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.2,0.7,0.2,1)' }}
      />
    </svg>
  );
}

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={clsx('skeleton', className)} style={style} aria-hidden />;
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex flex-col items-center px-6 py-10 text-center', className)}>
      {icon && <div className="mb-3 grid size-11 place-items-center rounded-full bg-surface-2 text-muted">{icon}</div>}
      <h3 className="text-[15.5px] font-bold">{title}</h3>
      {children && <div className="mt-1.5 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div className="card card-pad flex items-start gap-3 border-bad/30">
      <AlertCircle className="mt-0.5 size-5 flex-none text-bad" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Could not load this</p>
        <p className="mt-0.5 text-sm text-muted">{msg}</p>
      </div>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('mb-5 flex flex-wrap items-end gap-x-6 gap-y-3', className)}>
      <div className="min-w-0 flex-1">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-[26px] leading-[1.1] font-extrabold tracking-[-0.01em] sm:text-[30px]">{title}</h1>
        {sub && <p className="mt-1.5 max-w-[68ch] text-[15px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={clsx('mb-2.5 flex items-center justify-between gap-3', className)}>
      <h2 className="kicker">{children}</h2>
      {aside}
    </div>
  );
}

// ---------- tabs ----------
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: ReactNode; count?: number }[];
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="tablist" className={clsx('no-scrollbar flex gap-1 overflow-x-auto border-b border-line', className)}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={clsx(
              '-mb-px inline-flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-colors',
              size === 'sm' ? 'px-2.5 py-2 text-[13px]' : 'px-3 py-2.5 text-sm',
              active ? 'border-ink font-semibold text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {it.label}
            {it.count !== undefined && it.count > 0 && (
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] leading-none font-semibold tabular-nums">
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  items,
  className,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: ReactNode }[];
  className?: string;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx('inline-flex rounded-lg border border-line bg-surface-2 p-0.5', className)}>
      {items.map((it) => (
        <button
          key={it.value}
          role="radio"
          aria-checked={it.value === value}
          onClick={() => onChange(it.value)}
          className={clsx(
            'rounded-md px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors',
            it.value === value ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

// ---------- overlays ----------
function useLockScroll(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}

/** Centered dialog on desktop, bottom sheet on phones. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useLockScroll(open);
  useEscape(open, onClose);
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <div className="anim-fade-in absolute inset-0 bg-[rgb(10_12_18/0.5)]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          'anim-sheet-up sm:anim-pop-in relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-float outline-none sm:rounded-xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-[16px] font-bold">
            {title}
          </h2>
          <button className="icon-btn -mr-2" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && <div className="pb-safe flex flex-wrap justify-end gap-2 border-t border-line px-4 pt-3 sm:px-5 sm:pb-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Bottom sheet (phones). */
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  useLockScroll(open);
  useEscape(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end">
      <div className="anim-fade-in absolute inset-0 bg-[rgb(10_12_18/0.45)]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="anim-sheet-up relative flex h-[86dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-float"
      >
        <div className="flex justify-center pt-2 pb-1" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-line" />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button className={clsx('icon-btn', className)} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[12.5px] text-muted">{hint}</p>}
    </div>
  );
}

export function Kv({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(84px,30%)_minmax(0,1fr)] gap-3 py-1.5 text-[13.5px]">
      <dt className="text-muted">{k}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function LiveDot({ on = true, className }: { on?: boolean; className?: string }) {
  return (
    <span className={clsx('relative inline-flex size-2', className)} aria-hidden>
      {on && <span className="absolute inset-0 animate-ping rounded-full bg-ok opacity-60" />}
      <span className={clsx('relative inline-flex size-2 rounded-full', on ? 'bg-ok' : 'bg-muted')} />
    </span>
  );
}
