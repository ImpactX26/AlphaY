import type { RentalsBlock } from '@educaro/shared';
import clsx from 'clsx';
import { ChevronDown, ExternalLink, TramFront } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Spinner } from '../../ui/Spinner';
import { BlockFrame } from '../BlockFrame';

// Leaflet is ~150 KB, and the same chunk the places block already loads.
const RentalsMap = lazy(() => import('./RentalsMap'));

type Listing = RentalsBlock['listings'][number];

const KIND_LABEL: Record<Listing['kind'], string> = {
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
  // Which row is expanded. Separate from `active`, which is the map highlight and follows the
  // pointer — a panel that opened and closed on hover would be unusable.
  const [open, setOpen] = useState<string | null>(null);
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
              <Row key={l.id} l={l} block={block} open={open === l.id} onOpen={() => setOpen(open === l.id ? null : l.id)} active={active === l.id} onActive={setActive} />
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

/**
 * One room, and what sits behind the two numbers on its row.
 *
 * The row answers "how much, and how far". Tapping it answers the question that actually follows —
 * why that rent, and whether it is affordable *for them* — because a number with no reasoning under
 * it is something to take on trust, and not asking for that is the point of this product.
 *
 * Everything here is derived from what the API already sent. There is deliberately no photo and no
 * "contact the landlord": these are representative listings built from district averages, not live
 * adverts, and a façade over that would be the one dishonest thing on the page.
 */
function Row({
  l,
  block,
  open,
  onOpen,
  active,
  onActive,
}: {
  l: Listing;
  block: RentalsBlock;
  open: boolean;
  onOpen: () => void;
  active: boolean;
  onActive: (id: string | null) => void;
}) {
  const panelId = `rental-${l.id}`;
  const diff = block.budgetEur !== null ? l.warmRentEur - block.budgetEur : null;
  // The ceiling is 45% of the monthly total, so the total is recoverable from it.
  const share = block.budgetEur !== null ? Math.round((l.warmRentEur / (block.budgetEur / 0.45)) * 100) : null;
  // Each way, five days. The number people feel is the week, not the single trip.
  const weeklyH = l.commuteMin !== null ? Math.round((l.commuteMin * 2 * 5) / 6) / 10 : null;

  return (
    <li>
      <button
        type="button"
        onMouseEnter={() => onActive(l.id)}
        onMouseLeave={() => onActive(null)}
        onFocus={() => onActive(l.id)}
        onBlur={() => onActive(null)}
        onClick={onOpen}
        aria-expanded={open}
        aria-controls={panelId}
        className={clsx(
          'flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md px-2 py-2.5 text-left transition-colors',
          active || open ? 'bg-surface-2' : 'hover:bg-surface-2/60',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[14.5px] font-semibold leading-snug">
            <ChevronDown size={14} aria-hidden className={clsx('flex-none text-muted transition-transform', open && 'rotate-180')} />
            {l.title}
          </span>
          <span className="block pl-[22px] text-[12.5px] text-muted">
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
          <span className={clsx('num text-[14.5px] font-bold', l.affordable ? 'text-ok' : 'text-warn')}>{euro(l.warmRentEur)}</span>
        </span>
      </button>

      {open ? (
        <div id={panelId} className="mb-2.5 ml-[22px] mr-2 rounded-lg border border-line bg-surface-2/40 px-3.5 py-3">
          <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            <div>
              <dt className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">Warm rent</dt>
              <dd className="text-[13.5px]">
                <span className="num font-semibold">{euro(l.warmRentEur)}</span> a month
                {l.sizeSqm ? <span className="text-muted"> · {euro(l.warmRentEur / l.sizeSqm)} per m²</span> : null}
                <span className="mt-0.5 block text-[12.5px] text-muted">Warm means heating and service charges are already in it. Electricity and internet are not.</span>
              </dd>
            </div>

            {block.budgetEur !== null ? (
              <div>
                <dt className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">Against your budget</dt>
                <dd className={clsx('text-[13.5px]', l.affordable ? 'text-ok' : 'text-warn')}>
                  {l.affordable ? (
                    <>
                      Inside your <span className="num">{euro(block.budgetEur)}</span> ceiling
                      {diff !== null && diff < 0 ? <span className="text-muted"> · {euro(-diff)} under it</span> : null}
                    </>
                  ) : (
                    <>
                      <span className="num">{euro(diff ?? 0)}</span> over your <span className="num">{euro(block.budgetEur)}</span> ceiling
                    </>
                  )}
                  <span className="mt-0.5 block text-[12.5px] text-muted">
                    The ceiling is 45% of your monthly total{share !== null ? <>, and this room is about {share}% of it</> : null}. A rule of thumb, not a rule.
                  </span>
                </dd>
              </div>
            ) : null}

            {l.commuteMin !== null && block.anchor ? (
              <div>
                <dt className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">Getting to {block.anchor.label}</dt>
                <dd className="text-[13.5px]">
                  <span className="num">{l.commuteMin} min</span> each way, by public transport
                  {weeklyH !== null ? (
                    <span className="mt-0.5 block text-[12.5px] text-muted">
                      About <span className="num">{weeklyH} hours</span> a week getting there and back, five days.
                    </span>
                  ) : null}
                </dd>
              </div>
            ) : null}

            <div>
              <dt className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">{l.district}</dt>
              <dd className="text-[13.5px]">
                {KIND_LABEL[l.kind]}
                {l.sizeSqm ? <> · {l.sizeSqm} m²</> : null}
                <span className="mt-0.5 block text-[12.5px] text-muted">
                  This is the district average for this kind of place, not one advert. What you pay will land near it rather than on it.
                </span>
              </dd>
            </div>
          </dl>

          <p className="mt-3 flex flex-wrap gap-3 border-t border-line pt-2.5 text-[12.5px]">
            {l.url ? (
              <a href={l.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-semibold text-ink underline-offset-2 hover:underline">
                See the listing <ExternalLink size={11} aria-hidden />
              </a>
            ) : null}
            {l.mapsUrl ? (
              <a href={l.mapsUrl} target="_blank" rel="noreferrer noopener" className="text-muted underline-offset-2 hover:text-ink hover:underline">
                Show on the map
              </a>
            ) : null}
            {/* Rentals route from the room to the workplace, which is the number that decides it. */}
            {l.directionsUrl ? (
              <a href={l.directionsUrl} target="_blank" rel="noreferrer noopener" className="text-muted underline-offset-2 hover:text-ink hover:underline">
                Commute to work
              </a>
            ) : null}
          </p>
        </div>
      ) : (
        <span className="mb-2 ml-[22px] flex flex-wrap gap-3 text-[12.5px]">
          {l.mapsUrl ? (
            <a href={l.mapsUrl} target="_blank" rel="noreferrer noopener" className="text-muted underline-offset-2 hover:text-ink hover:underline">
              Show on the map
            </a>
          ) : null}
          {l.directionsUrl ? (
            <a href={l.directionsUrl} target="_blank" rel="noreferrer noopener" className="text-muted underline-offset-2 hover:text-ink hover:underline">
              Commute to work
            </a>
          ) : null}
        </span>
      )}
    </li>
  );
}
