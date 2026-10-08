import type { PlacesBlock } from '@educaro/shared';
import clsx from 'clsx';
import { BedDouble, Building2, Church, Cross, Dumbbell, GraduationCap, Landmark, MapPin, Shield, ShoppingBasket, Stethoscope, Train, Utensils } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Spinner } from '../../ui/Spinner';
import { BlockFrame } from '../BlockFrame';
import { PLACE_COLOR } from './placeStyle';

// Leaflet is ~150 KB: only the Germany-mode screen pays for it.
const PlacesMap = lazy(() => import('./PlacesMap'));

/** Keys match `place-groups.ts`. The previous set did not, so every category drew the same pin. */
const GROUP_ICON: Record<string, typeof MapPin> = {
  grocery: ShoppingBasket,
  supermarket: ShoppingBasket,
  restaurant: Utensils,
  temple: Church,
  church: Church,
  buergeramt: Building2,
  station: Train,
  pharmacy: Cross,
  doctor: Stethoscope,
  police: Shield,
  hostel: BedDouble,
  language_school: GraduationCap,
  bank: Landmark,
  gym: Dumbbell,
};

export function PlacesCard({ block }: { block: PlacesBlock }) {
  const [active, setActive] = useState<string | null>(null);
  // Which categories are drawn. Eight categories at once is a sheet of confetti rather than a map,
  // so a tap narrows it to the one question somebody actually has right now.
  const [only, setOnly] = useState<string | null>(null);

  const shown = only ? block.groups.filter((g) => g.kind === only) : block.groups;
  const places = shown.flatMap((g) => g.places.map((p) => ({ ...p, kind: g.kind, groupLabel: g.label })));

  return (
    <BlockFrame
      kicker={block.title ?? `Near you in ${block.city}`}
      body={block.body}
      footer={<span>Places from OpenStreetMap. Distances are straight-line, from your address.</span>}
    >
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setOnly(null)}
          aria-pressed={only === null}
          className={clsx('rounded-full border px-2.5 py-1 text-[12px] transition', only === null ? 'border-ink bg-ink font-medium text-surface' : 'border-line hover:border-ink/40')}
        >
          Everything
        </button>
        {block.groups.map((g) => {
          const Icon = GROUP_ICON[g.kind] ?? MapPin;
          return (
            <button
              key={g.kind}
              type="button"
              onClick={() => setOnly(only === g.kind ? null : g.kind)}
              aria-pressed={only === g.kind}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition',
                only === g.kind ? 'border-ink bg-ink font-medium text-surface' : 'border-line hover:border-ink/40',
              )}
            >
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: PLACE_COLOR[g.kind] ?? 'var(--ink)' }} aria-hidden />
              <Icon size={12} aria-hidden />
              {g.label}
              <span className="num text-muted">{g.places.length}</span>
            </button>
          );
        })}
      </div>

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
        {shown.map((group) => {
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
                      {/* The API hands us ready-made Google Maps links; on a phone these open the
                          map app the person already has, with no key and no embed. */}
                      {p.mapsUrl || p.directionsUrl ? (
                        <span className="flex gap-3 px-2 pb-1.5 text-[12px]">
                          {p.mapsUrl ? (
                            <a href={p.mapsUrl} target="_blank" rel="noreferrer noopener" className="text-muted underline-offset-2 hover:text-ink hover:underline">
                              Show on the map
                            </a>
                          ) : null}
                          {p.directionsUrl ? (
                            <a href={p.directionsUrl} target="_blank" rel="noreferrer noopener" className="text-muted underline-offset-2 hover:text-ink hover:underline">
                              How to get there
                            </a>
                          ) : null}
                        </span>
                      ) : null}
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
