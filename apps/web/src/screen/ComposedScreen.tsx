import type { Block, Screen } from '@educaro/shared';
import clsx from 'clsx';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ErrorBoundary } from '../app/ErrorBoundary';
import { Skeleton } from '../ui/misc';
import { BlockRenderer } from './BlockRenderer';
import { sectionPath } from './sections';

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
  budget: { to: '/app/life', page: 'Life' },
  route: { to: '/app/plan', page: 'Plan' },
  cohort: { to: '/app/plan', page: 'Plan' },
  places: { to: '/app/life', page: 'Life' },
  rentals: { to: '/app/life', page: 'Life' },
  arrival: { to: '/app/life', page: 'Life' },
  documents: { to: '/app/profile', page: 'Profile' },
  community: { to: '/app/inbox', page: 'Cohort' },
  // The five newer blocks are routed by the composer's `section` instead, which is why there is no
  // entry for them here: two tables deciding the same thing is how they come to disagree.
  finance_plan: { to: '/app/money', page: 'Money' },
  scam_check: { to: '/app/safety', page: 'Safety' },
  help: { to: '/app/safety', page: 'Safety' },
  reality_check: { to: '/app/plan', page: 'Plan' },
  cohort_group: { to: '/app/inbox', page: 'Cohort' },
};

// Everything else stays on Home, including the truth map and the requirement matrix: the agent
// raises those in answer to something, and sending the reader to another page to see the answer
// is worse than one more section here.

/**
 * Asks that may be folded into a one-line list when several pile up.
 *
 * `question` is deliberately absent: a guard caps open questions at two, and showing both is the
 * product's promise that it will not interrogate you. Hiding one behind a disclosure breaks that.
 */
const FOLDABLE: Block['type'][] = ['letters', 'next_step'];

/**
 * Blocks that are genuinely waiting on the applicant, most urgent first.
 *
 * The first of these on the page gets the lead rule. A question outranks a next step because it
 * blocks the agent: until it is answered, the plan underneath it is provisional.
 */
const ASKS: Block['type'][] = ['question', 'letters', 'next_step'];

/** One line in the "also waiting" list, so three more asks cost three lines instead of three panels. */
function waitingLabel(b: Block): string {
  switch (b.type) {
    case 'question':
      return b.prompt;
    case 'letters':
      return b.drafts.length === 1 ? 'A letter is ready for you to check' : `${b.drafts.length} letters ready for you to check`;
    case 'next_step':
      return b.title ?? 'Your next step';
    default:
      return b.title ?? b.type;
  }
}


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
  //
  // `section` on the block wins when the API sends it, because the API is what knows a block
  // exists; `ELSEWHERE` is the fallback for a stored screen composed before sections existed.
  const kept = useMemo(() => {
    if (!screen) return [];
    if (!focus) return screen.blocks;
    return screen.blocks.filter((b) => (b.section ? b.section === 'home' : !ELSEWHERE[b.type]));
  }, [screen, focus]);

  // Four things shouting at once is not a dashboard. The most urgent ask keeps its panel; the
  // rest become one line each, and open in place when tapped.
  const [openId, setOpenId] = useState<string | null>(null);
  const { shown, waiting, leadId } = useMemo(() => {
    if (!focus) return { shown: kept, waiting: [] as Block[], leadId: null as string | null };
    const asks = kept.filter((b) => FOLDABLE.includes(b.type));
    if (asks.length < 2) return { shown: kept, waiting: [] as Block[], leadId: null as string | null };
    const rest = asks.slice(1);
    const restIds = new Set(rest.map((b) => b.id));
    return {
      shown: kept.filter((b) => !restIds.has(b.id) || b.id === openId),
      waiting: rest.filter((b) => b.id !== openId),
      leadId: asks[0].id,
    };
  }, [kept, focus, openId]);

  // The one block the rule goes on: the most urgent thing actually waiting on them, in the order
  // it appears. Null when nothing is waiting, so a screen with no ask has no marked block at all.
  const firstAskId = useMemo(() => {
    for (const type of ASKS) {
      const hit = shown.find((b) => b.type === type);
      if (hit) return hit.id;
    }
    return null;
  }, [shown]);

  const movedOut = useMemo(() => {
    if (!screen || !focus) return [];
    // Keyed by path, not by label: two sections can share a page — `community` and `inbox` both
    // live at /app/inbox — and the links are rendered with the path as the React key, so keying
    // this map by label produced two entries with the same key and React dropped one.
    const pages = new Map<string, string>();
    // Prefer the API's own sections: it lists only the ones that have blocks, already in reading
    // order, so Home never offers a link to an empty page.
    if (screen.sections?.length) {
      for (const s of screen.sections) {
        if (s.id !== 'home' && s.blockIds.length) {
          const to = sectionPath(s.id);
          // `inbox` wins the shared path over `community`, so the chip matches the nav tab.
          if (!pages.has(to) || s.id === 'inbox') pages.set(to, s.label);
        }
      }
    } else {
      for (const b of screen.blocks) {
        const dest = ELSEWHERE[b.type];
        if (dest && !pages.has(dest.to)) pages.set(dest.to, dest.page);
      }
    }
    return [...pages].map(([to, page]) => ({ page, to }));
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
      <h1 className="headline max-w-[46ch]">{screen.headline}</h1>

      {shown.length ? (
        // Open sections are told apart by space, so the gap does the work a border used to.
        <div className="mt-6 space-y-5">
          {shown.map((block, i) => (
            <div
              key={block.id}
              className={clsx(
                entering.has(block.id) && 'block-enter',
                moved.has(block.id) && 'block-updated',
                // The single marked block on the page. `focus` keeps it to Home, where someone is
                // deciding what to do; the staff read-only view wants every block equal.
                focus && block.id === firstAskId && 'lead',
              )}
              style={entering.has(block.id) ? ({ '--delay': `${Math.min(i, 8) * 55}ms` } as CSSProperties) : undefined}
            >
              <ErrorBoundary label={blockLabel(block.type)}>
                <BlockRenderer block={block} compact={focus} />
              </ErrorBoundary>

              {/* The rest of the asks sit directly under the lead one, as lines rather than panels. */}
              {waiting.length && block.id === leadId ? (
                <section className="mt-3 overflow-hidden rounded-[var(--r)] border border-line bg-surface shadow-[var(--lift)]">
                  <h2 className="px-4 pt-3 text-[12.5px] font-semibold text-muted">Also waiting on you</h2>
                  <ul className="mt-1 divide-y divide-line">
                    {waiting.map((w) => (
                      <li key={w.id}>
                        <button
                          type="button"
                          onClick={() => setOpenId(w.id)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                        >
                          <span className="min-w-0 flex-1 text-[14px] leading-snug">{waitingLabel(w)}</span>
                          <ChevronRight size={16} className="flex-none text-muted" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}


      {movedOut.length ? (
        <nav aria-label="The rest of your plan" className="mt-6 flex flex-wrap gap-2">
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
  // The page's `types` order wins here: Life wants rentals before arrival even when the agent
  // ranked them the other way, because you pick a room before you plan your first week.
  const all = screen?.blocks ?? [];
  const blocks = types.flatMap((t) => all.filter((b) => b.type === t));
  if (!blocks.length) return null;
  return <BlockList blocks={blocks} className={className} />;
}

/**
 * Blocks in the order given, each boxed so one bad block cannot take the page with it.
 * Used by any page that has already decided what it is showing — a section, or a type filter.
 */
export function BlockList({ blocks, className }: { blocks: Block[]; className?: string }) {
  if (!blocks.length) return null;
  return (
    <div className={clsx('space-y-5', className)}>
      {blocks.map((b) => (
        <ErrorBoundary key={b.id} label={blockLabel(b.type)}>
          <BlockRenderer block={b} />
        </ErrorBoundary>
      ))}
    </div>
  );
}
