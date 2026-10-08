import type { Screen } from '@educaro/shared';
import clsx from 'clsx';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { Skeleton } from '../ui/misc';
import { BlockRenderer } from './BlockRenderer';

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

export function ComposedScreen({ screen, loading, className }: { screen: Screen | undefined; loading?: boolean; className?: string }) {
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
        <div className="mt-5 space-y-3.5">
          {screen.blocks.map((block, i) => (
            <div
              key={block.id}
              className={clsx(entering.has(block.id) && 'block-enter', moved.has(block.id) && 'block-updated')}
              style={entering.has(block.id) ? ({ '--delay': `${Math.min(i, 8) * 55}ms` } as CSSProperties) : undefined}
            >
              <BlockRenderer block={block} />
            </div>
          ))}
        </div>
      ) : null}

      {screen.footnote ? <p className="mt-5 border-t border-line pt-3 text-[13px] text-muted">{screen.footnote}</p> : null}
    </div>
  );
}
