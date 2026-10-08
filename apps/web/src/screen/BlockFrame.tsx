import clsx from 'clsx';
import type { ReactNode } from 'react';

/**
 * The outside of a block.
 *
 * A frame is a claim that something is a separate object. When every block carried one, a fee
 * footnote looked as important as a letter waiting to be sent, and a long plan read as a wall of
 * boxes. So the border is now reserved for blocks that are genuinely objects — something tonal,
 * something you act on — and everything else is an open section separated by space alone.
 *
 * `tone` decides it: a toned block is framed, a default block is not.
 */
export function BlockFrame({
  kicker,
  title,
  body,
  children,
  footer,
  tone = 'default',
  className,
  headerExtra,
  bare,
}: {
  /** The block's own heading. Rendered as a heading, not an uppercase micro-label. */
  kicker?: ReactNode;
  title?: string;
  body?: string;
  children?: ReactNode;
  footer?: ReactNode;
  tone?: 'default' | 'accent' | 'warn' | 'success' | 'quiet';
  className?: string;
  headerExtra?: ReactNode;
  /** The page already names this section, so the block does not repeat the heading. */
  bare?: boolean;
}) {
  const framed = tone !== 'default';
  const hasHeader = Boolean(!bare && (kicker || title)) || Boolean(headerExtra);
  // Framed blocks need inner padding; open ones sit directly on the page.
  const pad = framed ? 'px-4 sm:px-5' : '';

  return (
    <section
      className={clsx(
        'min-w-0',
        framed && 'overflow-hidden rounded-lg border',
        tone === 'accent' && 'border-agent/40 bg-[color-mix(in_srgb,var(--agent)_4%,var(--surface))]',
        tone === 'warn' && 'border-warn/40 bg-[color-mix(in_srgb,var(--warn)_5%,var(--surface))]',
        tone === 'success' && 'border-ok/40 bg-[color-mix(in_srgb,var(--ok)_4%,var(--surface))]',
        tone === 'quiet' && 'border-line bg-surface-2/50',
        className,
      )}
    >
      {hasHeader ? (
        <div className={clsx('flex items-baseline justify-between gap-3', pad, framed && 'pt-3.5')}>
          <div className="min-w-0">
            {!bare && kicker ? <h2 className="display text-[15px] font-bold leading-snug">{kicker}</h2> : null}
            {!bare && title ? <h2 className="display text-[17px] font-bold leading-snug">{title}</h2> : null}
          </div>
          {headerExtra}
        </div>
      ) : null}

      {body ? <p className={clsx('max-w-[62ch] text-[14.5px] leading-relaxed text-muted', pad, hasHeader ? 'mt-1' : framed && 'pt-3.5')}>{body}</p> : null}

      {children ? <div className={clsx(pad, hasHeader || body ? 'mt-3' : framed && 'pt-4')}>{children}</div> : null}

      {framed ? <div className={clsx(footer ? 'h-0' : 'h-4')} /> : null}
      {footer ? (
        <div className={clsx('mt-4 text-[13px] text-muted', framed ? 'border-t border-line bg-surface-2/40 px-4 py-2.5 sm:px-5' : 'pt-1')}>{footer}</div>
      ) : null}
    </section>
  );
}

/**
 * A micro-label for a line inside a block (not for block titles — those are headings now).
 * Sentence case: tracked-out uppercase above every heading was most of the old visual noise.
 */
export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx('text-[12px] font-semibold leading-none text-muted', className)}>{children}</p>;
}
