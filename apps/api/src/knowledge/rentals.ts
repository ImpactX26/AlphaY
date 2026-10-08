import { findCity, type CityInfo } from './cities';

/**
 * Rooms and flats, with the commute to the thing that decides their day.
 *
 * Rent alone does not tell anyone whether they can live somewhere. A room 80 euros cheaper and 50
 * minutes each way is not cheaper — it is two hours of a nursing shift gone, five days a week, in
 * a country where they do not yet speak the language well enough to make the time back socially.
 * So every listing carries its commute to the hospital or the campus, and whether it fits the
 * budget we already computed.
 *
 * These are representative listings, not live scrapes: WG-Gesucht and ImmoScout both forbid it in
 * their terms, and a prototype that quietly breaks a site's rules is not a prototype anyone can
 * ship. The rents are the district averages we already cite, the districts and coordinates are
 * real, and the block says so rather than implying a live feed.
 */

export interface RentalListing {
  id: string;
  title: string;
  district: string;
  kind: 'wg_room' | 'studio' | 'flat';
  warmRentEur: number;
  sizeSqm: number | null;
  lat: number;
  lon: number;
  url: string | null;
  note?: string;
}

/** District centres, so a pin lands in the district rather than on the city hall. */
const DISTRICTS: Record<string, { name: string; lat: number; lon: number; factor: number }[]> = {
  cologne: [
    { name: 'Ehrenfeld', lat: 50.9527, lon: 6.9177, factor: 1.0 },
    { name: 'Sülz', lat: 50.9169, lon: 6.9254, factor: 1.12 },
    { name: 'Nippes', lat: 50.9661, lon: 6.9489, factor: 0.95 },
    { name: 'Kalk', lat: 50.9387, lon: 7.0048, factor: 0.85 },
    { name: 'Mülheim', lat: 50.9631, lon: 7.0056, factor: 0.88 },
    { name: 'Deutz', lat: 50.9376, lon: 6.9742, factor: 1.05 },
  ],
  munich: [
    { name: 'Schwabing', lat: 48.1626, lon: 11.5862, factor: 1.15 },
    { name: 'Moosach', lat: 48.1797, lon: 11.5083, factor: 0.92 },
    { name: 'Neuperlach', lat: 48.1039, lon: 11.6386, factor: 0.85 },
    { name: 'Garching', lat: 48.2489, lon: 11.6511, factor: 0.9 },
    { name: 'Freimann', lat: 48.1908, lon: 11.6103, factor: 0.95 },
  ],
  aachen: [
    { name: 'Frankenberger Viertel', lat: 50.7703, lon: 6.0998, factor: 1.05 },
    { name: 'Ponttor', lat: 50.7812, lon: 6.0821, factor: 1.0 },
    { name: 'Burtscheid', lat: 50.7606, lon: 6.0914, factor: 0.95 },
    { name: 'Laurensberg', lat: 50.7932, lon: 6.0514, factor: 0.88 },
  ],
  darmstadt: [
    { name: 'Martinsviertel', lat: 49.8795, lon: 8.6519, factor: 1.05 },
    { name: 'Bessungen', lat: 49.8558, lon: 8.6494, factor: 0.98 },
    { name: 'Kranichstein', lat: 49.9009, lon: 8.6862, factor: 0.85 },
    { name: 'Lichtwiese', lat: 49.8626, lon: 8.6803, factor: 0.95 },
  ],
};

const TITLES: Record<RentalListing['kind'], string[]> = {
  wg_room: ['Room in a 3-person flatshare', 'Room in a quiet WG, two flatmates', 'Furnished room in a student WG'],
  studio: ['Studio flat, furnished', 'Small studio with a kitchenette', 'Studio, newly renovated'],
  flat: ['One-bedroom flat', 'Two-room flat with a balcony'],
};

const SIZES: Record<RentalListing['kind'], [number, number]> = { wg_room: [14, 22], studio: [26, 38], flat: [42, 58] };

/** Deterministic jitter, so the same city always produces the same list and a demo never shifts. */
function seeded(n: number, i: number): number {
  const x = Math.sin(n * 9301 + i * 49297) * 233280;
  return x - Math.floor(x);
}

export function listingsFor(cityName: string): RentalListing[] {
  const city = findCity(cityName);
  if (!city) return [];
  const districts = DISTRICTS[city.name.toLowerCase()];
  if (!districts) return [];
  const out: RentalListing[] = [];
  let i = 0;
  for (const d of districts) {
    for (const kind of ['wg_room', 'studio'] as const) {
      i += 1;
      const r = seeded(city.lat * 1000, i);
      const base = kind === 'wg_room' ? city.wgRoom : city.studio;
      const rent = Math.round(((base * d.factor * (0.9 + r * 0.22)) / 10) * 10);
      const [lo, hi] = SIZES[kind];
      out.push({
        id: `${city.name.toLowerCase()}-${d.name.toLowerCase().replace(/\W+/g, '-')}-${kind}`,
        title: TITLES[kind][Math.floor(r * TITLES[kind].length)],
        district: d.name,
        kind,
        warmRentEur: rent,
        sizeSqm: Math.round(lo + r * (hi - lo)),
        // Spread the pins inside the district instead of stacking them on its centre.
        lat: Number((d.lat + (seeded(i, 7) - 0.5) * 0.008).toFixed(5)),
        lon: Number((d.lon + (seeded(i, 13) - 0.5) * 0.012).toFixed(5)),
        url: null,
      });
    }
  }
  return out.sort((a, b) => a.warmRentEur - b.warmRentEur);
}

const EARTH_KM = 6371;
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return EARTH_KM * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Door to door by public transport, roughly.
 *
 * German cities are dense and well served, so straight-line distance times a detour factor plus a
 * fixed wait is close enough to be useful and is honest about being an estimate. Routing APIs that
 * do this properly need a key and a network call per listing, which is twelve calls for one screen.
 */
export function commuteMinutes(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
  const km = distanceKm(from, to) * 1.3; // the road is never the crow's line
  const walkBothEnds = 9;
  const wait = 6;
  const speedKmh = km < 2 ? 12 : 22; // short hops are a bike or a tram; longer ones an S-Bahn
  return Math.max(5, Math.round(walkBothEnds + wait + (km / speedKmh) * 60));
}

export function cityCentre(cityName: string): CityInfo | null {
  return findCity(cityName);
}
