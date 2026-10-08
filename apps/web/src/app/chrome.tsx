import clsx from 'clsx';
import { FlaskConical, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { isMock, setMockMode } from '../api/client';
import { useAuth } from '../auth/auth';
import { type ThemeChoice, useTheme } from '../lib/theme';
import { useAgentActivity } from '../realtime/agentStatus';
import { useConnection } from '../realtime/socket';
import { Avatar } from '../ui/misc';

export function Logo({ to, sub }: { to: string; sub?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-md text-ink no-underline" aria-label="Educaro home">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden className="flex-none">
        <rect width="32" height="32" rx="7" fill="var(--ink)" />
        <path d="M8 8h14v3.6h-9.7v2.7h8.4v3.4h-8.4v2.7H22V24H8z" fill="var(--bg)" />
        <rect x="23" y="14.3" width="3.4" height="3.4" rx=".8" fill="var(--applicant)" />
      </svg>
      <span className="display text-[19px] font-extrabold tracking-[-0.01em]">Educaro</span>
      {sub ? <span className="hidden border-l border-line pl-2.5 text-[13px] font-semibold text-staff sm:inline">{sub}</span> : null}
    </Link>
  );
}

const THEME_ICON: Record<ThemeChoice, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };
const THEME_NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_LABEL: Record<ThemeChoice, string> = { system: 'Theme: follows your device', light: 'Theme: light', dark: 'Theme: dark' };

export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const Icon = THEME_ICON[theme];
  return (
    <button type="button" className="icon-btn" onClick={() => setTheme(THEME_NEXT[theme])} aria-label={`${THEME_LABEL[theme]}. Change theme`} title={THEME_LABEL[theme]}>
      <Icon size={18} aria-hidden />
    </button>
  );
}

/** A small popover menu: button + panel, closes on outside click and Esc. */
export function Menu({ trigger, label, children, align = 'right' }: { trigger: ReactNode; label: string; children: (close: () => void) => ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="flex items-center rounded-full" aria-haspopup="menu" aria-expanded={open} aria-controls={id} aria-label={label} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open ? (
        <div
          id={id}
          role="menu"
          className={clsx(
            'pop-in absolute top-[calc(100%+8px)] z-40 w-64 overflow-hidden rounded-lg border border-line bg-surface py-1.5 shadow-[var(--overlay-shadow)]',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({ icon: Icon, children, onClick }: { icon?: typeof Sun; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[14px] hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none">
      {Icon ? <Icon size={16} aria-hidden className="text-muted" /> : null}
      {children}
    </button>
  );
}

export function UserMenu({ tone = 'applicant', extra }: { tone?: 'applicant' | 'staff'; extra?: (close: () => void) => ReactNode }) {
  const { me, signOut } = useAuth();
  if (!me) return null;
  return (
    <Menu label="Account menu" trigger={<Avatar name={me.name} tone={tone} size={34} />}>
      {(close) => (
        <>
          <div className="border-b border-line px-3.5 pb-2.5 pt-1.5">
            <p className="truncate text-[14px] font-semibold">{me.name}</p>
            <p className="truncate text-[12.5px] text-muted">{me.email}</p>
          </div>
          {extra?.(close)}
          {isMock ? (
            <MenuItem icon={FlaskConical} onClick={() => setMockMode(false)}>
              Leave demo data, use the live API
            </MenuItem>
          ) : null}
          <MenuItem
            icon={LogOut}
            onClick={() => {
              close();
              signOut();
            }}
          >
            Sign out
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

/** Live status of the agent for one applicant: the "agent is working…" indicator. */
export function AgentPill({ applicantId, className }: { applicantId: string | null; className?: string }) {
  const activity = useAgentActivity(applicantId);
  const connection = useConnection();
  const busy = activity.status !== 'idle';
  const text = busy ? (activity.detail ?? (activity.status === 'thinking' ? 'Thinking…' : 'Working…')) : connection === 'live' ? 'Live' : connection === 'connecting' ? 'Reconnecting…' : 'Offline';
  return (
    <span
      className={clsx(
        'inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors',
        busy ? 'border-agent/40 bg-agent/10 text-agent' : 'border-line text-muted',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className={clsx('h-2 w-2 flex-none rounded-full', busy ? 'breathe bg-agent' : connection === 'live' ? 'bg-ok' : 'bg-warn')} aria-hidden />
      <span className="truncate">{busy ? `Agent: ${text}` : text}</span>
    </span>
  );
}

export function MockBadge() {
  if (!isMock) return null;
  return (
    <span className="hidden items-center gap-1.5 rounded-full border border-dashed border-loop/60 px-2.5 py-1 text-[12px] font-semibold text-loop sm:inline-flex" title="Mock mode: example data, no server">
      <FlaskConical size={13} aria-hidden />
      Demo data
    </span>
  );
}
