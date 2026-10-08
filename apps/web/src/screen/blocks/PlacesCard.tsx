import type { PlacesBlock } from '@educaro/shared';
import clsx from 'clsx';
import { Building2, Church, Cross, MapPin, ShoppingBasket, Train, Utensils } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Spinner } from '../../ui/Spinner';
import { BlockFrame, Kicker } from '../BlockFrame';

// Leaflet is ~150 KB: only the Germany-mode screen pays for it.
const PlacesMap = lazy(() => import('./PlacesMap'));

const GROUP_ICON: Record<string, typeof MapPin> = {
  office: Building2,
  grocery: ShoppingBasket,
  worship: Church,
  pharmacy: Cross,
  restaurant: Utensils,
  transport: Train,
};

export function PlacesCard({ block }: { block: PlacesBlock }) {
  const [active, setActive] = useState<string | null>(null);
  const places = block.groups.flatMap((g) => g.places.map((p) => ({ ...p, kind: g.kind, groupLabel: g.label })));
  return (
    <BlockFrame
      kicker={<Kicker>{block.title ?? `Near you in ${block.city}`}</Kicker>}
      body={block.body}
      footer={<span>Places from OpenStreetMap. Distances are straight-line, from your address.</span>}
    >
      <div className="overflow-hidden rounded-lg border border-line">
        <Suspense
          fallback={
            <div className="grid h-[260px] place-items-center bg-surface-2 text-[13px] text-muted">
              <span className="flex items-center gap-2">
                <Spinner size={15} /> Loading the map
              </span>
            </div>
          }
        >
          <PlacesMap center={block.center} city={block.city} places={places} active={active} onActive={setActive} />
        </Suspense>
      </div>
      <div className="mt-3 space-y-3">
        {block.groups.map((group) => {
          const Icon = GROUP_ICON[group.kind] ?? MapPin;
          return (
            <section key={group.kind}>
              <h3 className="mb-1.5 flex items-center gap-2 text-[13px] font-bold">
                <Icon size={15} className="flex-none text-muted" aria-hidden />
                {group.label}
              </h3>
              <ul className="space-y-1">
                {group.places.map((p) => {
                  const key = `${p.name}-${p.lat}-${p.lon}`;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(key)}
                        onFocus={() => setActive(key)}
                        onClick={() => setActive(key)}
                        className={clsx(
                          'flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[13.5px] transition-colors',
                          active === key ? 'bg-surface-2' : 'hover:bg-surface-2/60',
                        )}
                      >
                        <span className="min-w-0">
                          {p.name}
                          {p.address ? <span className="block text-[12px] text-muted">{p.address}</span> : null}
                        </span>
                        {p.distanceM !== undefined ? (
                          <span className="num flex-none text-[12.5px] text-muted">{p.distanceM < 1000 ? `${p.distanceM} m` : `${(p.distanceM / 1000).toFixed(1)} km`}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </BlockFrame>
  );
}
