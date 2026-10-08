/**
 * A colour per place category.
 *
 * Its own module rather than living beside the map, because `PlacesMap` imports Leaflet at the top
 * and is lazy-loaded for exactly that reason — importing a constant out of it would drag 150 KB of
 * mapping library into the main bundle to fetch a hex value.
 *
 * These keys must match `place-groups.ts` on the API side. They did not: the map was written
 * against `office`, `worship` and `transport`, categories that no longer exist, so every pin fell
 * through to the default and the map rendered in one colour. A legend that distinguishes nothing is
 * worse than no legend, because it looks like it is telling you something.
 */
export const PLACE_COLOR: Record<string, string> = {
  grocery: 'var(--applicant)',
  supermarket: 'var(--applicant)',
  restaurant: 'var(--loop)',
  temple: 'var(--staff)',
  church: 'var(--staff)',
  buergeramt: 'var(--agent)',
  station: 'var(--rules)',
  pharmacy: 'var(--bad)',
  doctor: 'var(--bad)',
  police: 'var(--ink)',
  hostel: 'var(--warn)',
  language_school: 'var(--agent)',
  bank: 'var(--ok)',
  gym: 'var(--ok)',
};
