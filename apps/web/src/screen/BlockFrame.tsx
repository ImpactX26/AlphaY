import clsx from 'clsx';
import type { ReactNode } from 'react';

/** Every block looks the same from the outside: a card with the agent's own title and body. */
export function BlockFrame({
  kicker,
  title,
  body,
  children,
  footer,
  tone = 'default',
  className,
  headerExtra,
}: {
  kicker?: ReactNode;
  title?: string;
  body?: string;
  children?: ReactNode;
  footer?: ReactNode;
  tone?: 'default' | 'accent' | 'warn' | 'success' | 'quiet';
  className?: string;
  headerExtra?: ReactNode;
}) {
  const hasHeader = Boolean(kicker || title || headerExtra);
  return (
    <section
      className={clsx(
        'card overflow-hidden',
        tone === 'accent' && 'border-agent/45 bg-[color-mix(in_srgb,var(--agent)_5%,var(--surface))]',
        tone === 'warn' && 'border-warn/45 bg-[color-mix(in_srgb,var(--warn)_6%,var(--surface))]',
        tone === 'success' && 'border-ok/45 bg-[color-mix(in_srgb,var(--ok)_5%,var(--surface))]',
        tone === 'quiet' && 'bg-surface-2/60',
        className,
      )}
    >
      {hasHeader ? (
        <div className="flex items-start justify-between gap-3 px-4 pt-3.5 sm:px-5">
          <div className="min-w-0">
            {kicker ? <div className="mb-1.5">{kicker}</div> : null}
            {title ? <h2 className="display text-[17px] font-bold leading-snug">{title}</h2> : null}
          </div>
          {headerExtra}
        </div>
      ) : null}
      {body ? <p className="px-4 pt-2 text-[14.5px] leading-relaxed sm:px-5">{body}</p> : null}
      {children ? <div className={clsx('px-4 sm:px-5', hasHeader || body ? 'pt-3' : 'pt-4')}>{children}</div> : null}
      <div className={clsx(footer ? 'h-0' : 'h-4')} />
      {footer ? <div className="mt-4 border-t border-line bg-surface-2/40 px-4 py-2.5 text-[13px] text-muted sm:px-5">{footer}</div> : null}
    </section>
  );
}

/** Uppercase micro-label inside a block, as on the spec's mock screens. */
export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx('text-[10.5px] font-bold uppercase leading-none tracking-[0.08em] text-muted', className)}>{children}</p>;
}
