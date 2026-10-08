import type { RentalsBlock } from '@educaro/shared';
import clsx from 'clsx';
import { ExternalLink, TramFront } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Spinner } from '../../ui/Spinner';
import { BlockFrame } from '../BlockFrame';

// Leaflet is ~150 KB, and the same chunk the places block already loads.
const RentalsMap = lazy(() => import('./RentalsMap'));

const KIND_LABEL: Record<RentalsBlock['listings'][number]['kind'], string> = {
  wg_room: 'Room in a shared flat',
  studio: 'Studio',
  flat: 'Flat',
};

const euro = (n: number) => `€${Math.round(n).toLocaleString('en-GB')}`;

/**
 * Rooms and flats near where they are going.
 *
 * Rent and commute sit on the same line on purpose: 80 euros cheaper and 50 minutes each way is
 * not cheaper, and the contract makes that the whole point of the block. `affordable` is computed
 * by the API against their budget, so this only colours it.
 */
export function RentalsCard({ block, bare }: { block: RentalsBlock; bare?: boolean }) {
  const [active, setActive] = useState<string | null>(null);
  const within = block.listings.filter((l) => l.affordable).length;

  return (
    <BlockFrame
      bare={bare}
      kicker={block.title ?? `Where you could live in ${block.city}`}
      body={block.body}
      headerExtra={
        block.budgetEur ? (
          <span className="flex-none text-[12.5px] text-muted">
            <span className="num font-semibold text-ink">{within}</span> of {block.listings.length} within {euro(block.budgetEur)}
          </span>
        ) : undefined
      }
      footer={
        <span>
          {block.source}
          {block.anchor ? <> · Commute is to {block.anchor.label}.</> : null}
        </span>
      }
    >
      {block.listings.length ? (
        <>
          <div className="overflow-hidden rounded-lg border border-line">
            <Suspense fallback={<div className="grid h-[280px] place-items-center bg-surface-2"><Spinner label="Loading the map" /></div>}>
              <RentalsMap block={block} active={active} onActive={setActive} />
            </Suspense>
          </div>

          <ul className="mt-3 divide-y divide-line">
            {block.listings.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(l.id)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(l.id)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive(active === l.id ? null : l.id)}
                  aria-pressed={active === l.id}
                  className={clsx(
                    'flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md px-2 py-2.5 text-left transition-colors',
                    active === l.id ? 'bg-surface-2' : 'hover:bg-surface-2/60',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold leading-snug">{l.title}</span>
                    <span className="block text-[12.5px] text-muted">
                      {KIND_LABEL[l.kind]} · {l.district}
                      {l.sizeSqm ? ` · ${l.sizeSqm} m²` : ''}
                      {l.note ? ` · ${l.note}` : ''}
                    </span>
                  </span>

                  {/* Price and commute together: one without the other decides nothing. */}
                  <span className="flex flex-none items-baseline gap-3">
                    {l.commuteMin !== null ? (
                      <span className="inline-flex items-baseline gap-1 text-[12.5px] text-muted">
                        <TramFront size={13} className="translate-y-0.5" aria-hidden />
                        <span className="num">{l.commuteMin} min</span>
                      </span>
                    ) : null}
                    <span className={clsx('num text-[14.5px] font-bold', l.affordable ? 'text-ok' : 'text-warn')}>
                      {euro(l.warmRentEur)}
                    </span>
                  </span>
                </button>
                {l.url ? (
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mb-2 ml-2 inline-flex items-center gap-1 text-[12.5px] text-muted underline-offset-2 hover:text-ink hover:underline"
                  >
                    See the listing <ExternalLink size={11} aria-hidden />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-[14px] text-muted">
          No rooms found near {block.city} yet. The agent looks again as your start date gets closer.
        </p>
      )}
    </BlockFrame>
  );
}
