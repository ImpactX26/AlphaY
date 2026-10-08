import type { Block, Screen } from '@educaro/shared';
import clsx from 'clsx';
import { ArrowRight } from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ErrorBoundary } from '../app/ErrorBoundary';
import { Skeleton } from '../ui/misc';
import { BlockRenderer } from './BlockRenderer';

/** "requirement_matrix" reads as "Requirement matrix" when a block fails to draw. */
function blockLabel(type: string): string {
  const words = type.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Blocks the agent moved or added since the last render get a short enter animation. */
function useBlockMotion(screen: Screen | undefined) {
  const seen = useRef(new Map<string, number>());
  const firstRender = useRef(true);
  const [entering, setEntering] = useState<Set<string>>(new Set());
  const [moved, setMoved] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!screen) return;
    const isFirst = firstRender.current;
    firstRender.current = false;
    const nextEntering = new Set<string>();
    const nextMoved = new Set<string>();
    screen.blocks.forEach((b, i) => {
      const was = seen.current.get(b.id);
      if (was === undefined) nextEntering.add(b.id);
      else if (was !== i && !isFirst) nextMoved.add(b.id);
    });
    seen.current = new Map(screen.blocks.map((b, i) => [b.id, i]));
    if (isFirst) {
      setEntering(new Set(screen.blocks.map((b) => b.id)));
      return;
    }
    if (nextEntering.size) setEntering(nextEntering);
    if (nextMoved.size) setMoved(nextMoved);
    const t = setTimeout(() => {
      setEntering(new Set());
      setMoved(new Set());
    }, 1200);
    return () => clearTimeout(t);
  }, [screen]);

  return { entering, moved };
}

/**
 * Block types that already have a page of their own. Home links to those pages instead of
 * repeating them, so one screen is not fourteen blocks deep.
 */
const ELSEWHERE: Partial<Record<Block['type'], { to: string; page: string }>> = {
  // Standing reference: true all month, and each already has a page that owns it.
  gap_plan: { to: '/app/plan', page: 'Plan' },
  readiness: { to: '/app/plan', page: 'Plan' },
  timeline: { to: '/app/plan', page: 'Plan' },
  services: { to: '/app/plan', page: 'Plan' },
  budget: { to: '/app/plan', page: 'Plan' },
  route: { to: '/app/plan', page: 'Plan' },
  cohort: { to: '/app/plan', page: 'Plan' },
  places: { to: '/app/plan', page: 'Plan' },
  rentals: { to: '/app/plan', page: 'Plan' },
  arrival: { to: '/app/plan', page: 'Plan' },
  documents: { to: '/app/profile', page: 'Profile' },
  community: { to: '/app/inbox', page: 'Cohort' },
};

// Everything else stays on Home, including the truth map and the requirement matrix: the agent
// raises those in answer to something, and sending the reader to another page to see the answer
// is worse than one more section here.


export function ComposedScreen({ screen: raw, loading, className, focus }: { screen: Screen | undefined; loading?: boolean; className?: string; focus?: boolean }) {
  // An API that is still being built can omit `blocks` or send a non-array. One normalisation here
  // keeps every access below honest, instead of a `?.` on each one.
  const screen = useMemo<Screen | undefined>(
    () => (raw ? { ...raw, blocks: Array.isArray(raw.blocks) ? raw.blocks.filter((b) => b && typeof b.id === 'string') : [] } : undefined),
    [raw],
  );
  const { entering, moved } = useBlockMotion(screen);

  // Home asks for `focus`: keep what needs an answer or a tap now, and point at the page that
  // owns the rest. Without it every block renders, which is what the staff read-only view wants.
  const shown = useMemo(() => {
    if (!screen) return [];
    if (!focus) return screen.blocks;
    return screen.blocks.filter((b) => !ELSEWHERE[b.type]);
  }, [screen, focus]);

  const movedOut = useMemo(() => {
    if (!screen || !focus) return [];
    const pages = new Map<string, string>();
    for (const b of screen.blocks) {
      const dest = ELSEWHERE[b.type];
      if (dest) pages.set(dest.page, dest.to);
    }
    return [...pages].map(([page, to]) => ({ page, to }));
  }, [screen, focus]);

  if (loading && !screen)
    return (
      <div className={clsx('space-y-4', className)}>
        <Skeleton className="h-[72px] w-full max-w-xl" />
        <Skeleton className="h-[120px] w-full" />
        <Skeleton className="h-[180px] w-full" />
      </div>
    );
  if (!screen) return null;

  return (
    <div className={clsx('min-w-0', className)}>
      {/* The agent's own words: the big line at the top. */}
      <h1 className="headline max-w-[34ch]">{screen.headline}</h1>

      {shown.length ? (
        // Open sections are told apart by space, so the gap does the work a border used to.
        <div className="mt-7 space-y-7">
          {shown.map((block, i) => (
            <div
              key={block.id}
              className={clsx(entering.has(block.id) && 'block-enter', moved.has(block.id) && 'block-updated')}
              style={entering.has(block.id) ? ({ '--delay': `${Math.min(i, 8) * 55}ms` } as CSSProperties) : undefined}
            >
              <ErrorBoundary label={blockLabel(block.type)}>
                <BlockRenderer block={block} />
              </ErrorBoundary>
            </div>
          ))}
        </div>
      ) : null}

      {movedOut.length ? (
        <nav aria-label="The rest of your plan" className="mt-7 flex flex-wrap gap-2">
          {movedOut.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[13.5px] font-semibold shadow-[var(--lift)] transition-colors hover:border-ink"
            >
              {m.page}
              <ArrowRight size={14} aria-hidden />
            </Link>
          ))}
        </nav>
      ) : null}

      {screen.footnote ? <p className="mt-5 border-t border-line pt-3 text-[13px] text-muted">{screen.footnote}</p> : null}
    </div>
  );
}

/**
 * Renders just the block types a page owns, in the agent's order.
 * Home hands the rest off with `focus`; this is the other half of that split.
 */
export function BlocksOfType({ screen, types, className }: { screen: Screen | undefined; types: Block['type'][]; className?: string }) {
  const blocks = (screen?.blocks ?? []).filter((b) => types.includes(b.type));
  if (!blocks.length) return null;
  return (
    <div className={clsx('space-y-7', className)}>
      {blocks.map((b) => (
        <ErrorBoundary key={b.id} label={blockLabel(b.type)}>
          <BlockRenderer block={b} />
        </ErrorBoundary>
      ))}
    </div>
  );
}
