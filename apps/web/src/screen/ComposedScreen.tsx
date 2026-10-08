import type { Screen } from '@educaro/shared';
import clsx from 'clsx';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
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

export function ComposedScreen({ screen: raw, loading, className }: { screen: Screen | undefined; loading?: boolean; className?: string }) {
  // An API that is still being built can omit `blocks` or send a non-array. One normalisation here
  // keeps every access below honest, instead of a `?.` on each one.
  const screen = useMemo<Screen | undefined>(
    () => (raw ? { ...raw, blocks: Array.isArray(raw.blocks) ? raw.blocks.filter((b) => b && typeof b.id === 'string') : [] } : undefined),
    [raw],
  );
  const { entering, moved } = useBlockMotion(screen);

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

      {screen.blocks.length ? (
        // Open sections are told apart by space, so the gap does the work a border used to.
        <div className="mt-7 space-y-7">
          {screen.blocks.map((block, i) => (
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

      {screen.footnote ? <p className="mt-5 border-t border-line pt-3 text-[13px] text-muted">{screen.footnote}</p> : null}
    </div>
  );
}
