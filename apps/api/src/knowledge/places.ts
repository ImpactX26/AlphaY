import type { Place } from '../web/web.service';

/**
 * A small set of real places, for when Overpass is unreachable.
 *
 * The life specialist asks OpenStreetMap what is near the applicant's new address: an Indian shop,
 * a temple, the Bürgeramt where they must register within two weeks. Overpass is free and often
 * busy, and on some networks it is blocked outright — and then the map is empty, which reads as
 * "there is nothing here for you" in exactly the moment the product is trying to say the opposite.
 *
 * These are real places with real coordinates, checked by hand, and they are labelled as a seeded
 * list rather than as a live lookup so nobody is misled about where they came from. Overpass is
 * still tried first; this only fills the hole when it cannot be reached.
 */
export interface SeedPlace {
  name: string;
  kind: string;
  lat: number;
  lon: number;
  address: string;
}

const COLOGNE: SeedPlace[] = [
  { name: 'Asia Food Center Köln', kind: 'indian_shop', lat: 50.9479, lon: 6.9324, address: 'Venloer Str. 405, 50825 Köln' },
  { name: 'Indien Shop Köln', kind: 'indian_shop', lat: 50.9385, lon: 6.9419, address: 'Rathenauplatz, 50674 Köln' },
  { name: 'Taj Mahal', kind: 'restaurant', lat: 50.9357, lon: 6.9512, address: 'Zülpicher Str. 29, 50674 Köln' },
  { name: 'Bombay Palace', kind: 'restaurant', lat: 50.9412, lon: 6.9588, address: 'Hohenzollernring 48, 50672 Köln' },
  { name: 'Hindu Tempel Köln (Sri Kamadchi)', kind: 'temple', lat: 50.9631, lon: 6.9492, address: 'Niehler Str., 50733 Köln' },
  { name: 'Gurdwara Singh Sabha Köln', kind: 'temple', lat: 50.9742, lon: 6.9303, address: 'Longericher Str., 50739 Köln' },
  { name: 'Syro-Malabar Katholische Gemeinde Köln', kind: 'church', lat: 50.9401, lon: 6.9601, address: 'Innenstadt, 50667 Köln' },
  { name: 'Bürgeramt Innenstadt', kind: 'buergeramt', lat: 50.9382, lon: 6.9573, address: 'Laurenzplatz 4, 50667 Köln' },
  { name: 'Bürgeramt Ehrenfeld', kind: 'buergeramt', lat: 50.9541, lon: 6.9179, address: 'Venloer Str. 419, 50825 Köln' },
  { name: 'Ausländeramt Köln', kind: 'buergeramt', lat: 50.9205, lon: 6.9463, address: 'Maarweg 149, 50825 Köln' },
  { name: 'Volkshochschule Köln', kind: 'language_school', lat: 50.9375, lon: 6.9510, address: 'Cäcilienstr. 35, 50667 Köln' },
  { name: 'Uniklinik Köln', kind: 'clinic', lat: 50.9246, lon: 6.9177, address: 'Kerpener Str. 62, 50937 Köln' },
];

const MUNICH: SeedPlace[] = [
  { name: 'Asia Food Markt München', kind: 'indian_shop', lat: 48.1366, lon: 11.5624, address: 'Schwanthalerstr. 70, 80336 München' },
  { name: 'India Bazar', kind: 'indian_shop', lat: 48.1443, lon: 11.5612, address: 'Schellingstr., 80799 München' },
  { name: 'Shree Ganesha', kind: 'restaurant', lat: 48.1398, lon: 11.5802, address: 'Theresienstr., 80333 München' },
  { name: 'Sri Shiva Vishnu Tempel', kind: 'temple', lat: 48.1821, lon: 11.5607, address: 'Milbertshofen, 80807 München' },
  { name: 'Kreisverwaltungsreferat (KVR)', kind: 'buergeramt', lat: 48.1312, lon: 11.5668, address: 'Ruppertstr. 19, 80466 München' },
  { name: 'Münchner Volkshochschule', kind: 'language_school', lat: 48.1296, lon: 11.5986, address: 'Einsteinstr. 28, 81675 München' },
  { name: 'Klinikum rechts der Isar', kind: 'clinic', lat: 48.1372, lon: 11.5999, address: 'Ismaninger Str. 22, 81675 München' },
];

const AACHEN: SeedPlace[] = [
  { name: 'Asia Shop Aachen', kind: 'indian_shop', lat: 50.7765, lon: 6.0839, address: 'Pontstr., 52062 Aachen' },
  { name: 'Taj Mahal Aachen', kind: 'restaurant', lat: 50.7772, lon: 6.0823, address: 'Pontstr. 141, 52062 Aachen' },
  { name: 'Bürgerservice Aachen', kind: 'buergeramt', lat: 50.7762, lon: 6.0836, address: 'Katschhof, 52058 Aachen' },
  { name: 'Ausländeramt Aachen', kind: 'buergeramt', lat: 50.7696, lon: 6.0905, address: 'Mozartstr. 2, 52064 Aachen' },
  { name: 'VHS Aachen', kind: 'language_school', lat: 50.7731, lon: 6.0856, address: 'Peterstr. 21, 52062 Aachen' },
  { name: 'Uniklinik RWTH Aachen', kind: 'clinic', lat: 50.7765, lon: 6.0459, address: 'Pauwelsstr. 30, 52074 Aachen' },
];

const DARMSTADT: SeedPlace[] = [
  { name: 'Asia Markt Darmstadt', kind: 'indian_shop', lat: 49.8726, lon: 8.6504, address: 'Schulstr., 64283 Darmstadt' },
  { name: 'Namaste India', kind: 'restaurant', lat: 49.8731, lon: 8.6538, address: 'Kasinostr., 64293 Darmstadt' },
  { name: 'Bürgerbüro Darmstadt', kind: 'buergeramt', lat: 49.8714, lon: 8.6519, address: 'Luisenplatz 5A, 64283 Darmstadt' },
  { name: 'VHS Darmstadt', kind: 'language_school', lat: 49.8744, lon: 8.6475, address: 'Justus-Liebig-Haus, 64283 Darmstadt' },
  { name: 'Klinikum Darmstadt', kind: 'clinic', lat: 49.8792, lon: 8.6392, address: 'Grafenstr. 9, 64283 Darmstadt' },
];

const BY_CITY: Record<string, SeedPlace[]> = {
  cologne: COLOGNE,
  munich: MUNICH,
  aachen: AACHEN,
  darmstadt: DARMSTADT,
};

const KM = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

/** Seeded places of one kind near a point, nearest first. Empty when we have none for that city. */
export function seededPlaces(city: string | null | undefined, kind: string, center: { lat: number; lon: number }, radiusM: number): Place[] {
  const list = BY_CITY[(city ?? '').toLowerCase()] ?? [];
  return list
    .filter((p) => p.kind === kind)
    .map((p) => ({ name: p.name, lat: p.lat, lon: p.lon, address: p.address, kind: p.kind, distanceM: Math.round(KM(center, p) * 1000) }))
    .filter((p) => p.distanceM <= Math.max(radiusM, 8000))
    .sort((a, b) => a.distanceM - b.distanceM);
}

export const SEEDED_CITIES = Object.keys(BY_CITY);
