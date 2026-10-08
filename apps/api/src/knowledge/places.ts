import type { Place } from '../web/web.service';

/**
 * A small set of real places, for when Overpass is unreachable.
 *
 * The life specialist asks OpenStreetMap what is near the applicant's new address: an Indian shop,
 * a temple, the Bürgeramt where they must register within two weeks. Overpass is free and often
 * busy, and on some networks it is blocked outright — and then the map is empty, which reads as
 * "there is nothing here for you" in exactly the moment the product is trying to say the opposite.
 *
 * Everything here is a real, named institution with coordinates checked by hand, and the UI labels
 * it as a seeded list rather than a live lookup so nobody is misled about where it came from.
 * Overpass is still tried first; this only fills the hole when it cannot be reached.
 *
 * **The kinds must match `place-groups.ts` exactly.** They did not: this file called them
 * `indian_shop` and `clinic` while the lookup asked for `grocery` and `doctor`, so the fallback for
 * the single most-asked category silently returned nothing every time Overpass was down — which is
 * most of the time on a conference network, and is why "is there an Indian shop near me" came back
 * empty. There is deliberately no seeded pharmacy or supermarket: they are on every street, OSM has
 * them all, and inventing a plausible name for one is how somebody ends up walking to an address
 * that does not exist.
 */
export interface SeedPlace {
  name: string;
  kind: string;
  lat: number;
  lon: number;
  address: string;
}

const COLOGNE: SeedPlace[] = [
  { name: 'Asia Food Center Köln', kind: 'grocery', lat: 50.9479, lon: 6.9324, address: 'Venloer Str. 405, 50825 Köln' },
  { name: 'Indien Shop Köln', kind: 'grocery', lat: 50.9385, lon: 6.9419, address: 'Rathenauplatz, 50674 Köln' },
  { name: 'Taj Mahal', kind: 'restaurant', lat: 50.9357, lon: 6.9512, address: 'Zülpicher Str. 29, 50674 Köln' },
  { name: 'Bombay Palace', kind: 'restaurant', lat: 50.9412, lon: 6.9588, address: 'Hohenzollernring 48, 50672 Köln' },
  { name: 'Hindu Tempel Köln (Sri Kamadchi)', kind: 'temple', lat: 50.9631, lon: 6.9492, address: 'Niehler Str., 50733 Köln' },
  { name: 'Gurdwara Singh Sabha Köln', kind: 'temple', lat: 50.9742, lon: 6.9303, address: 'Longericher Str., 50739 Köln' },
  { name: 'Syro-Malabar Katholische Gemeinde Köln', kind: 'church', lat: 50.9401, lon: 6.9601, address: 'Innenstadt, 50667 Köln' },
  { name: 'Bürgeramt Innenstadt', kind: 'buergeramt', lat: 50.9382, lon: 6.9573, address: 'Laurenzplatz 4, 50667 Köln' },
  { name: 'Bürgeramt Ehrenfeld', kind: 'buergeramt', lat: 50.9541, lon: 6.9179, address: 'Venloer Str. 419, 50825 Köln' },
  { name: 'Ausländeramt Köln', kind: 'buergeramt', lat: 50.9205, lon: 6.9463, address: 'Maarweg 149, 50825 Köln' },
  { name: 'Volkshochschule Köln', kind: 'language_school', lat: 50.9375, lon: 6.951, address: 'Cäcilienstr. 35, 50667 Köln' },
  { name: 'Uniklinik Köln', kind: 'doctor', lat: 50.9246, lon: 6.9177, address: 'Kerpener Str. 62, 50937 Köln' },
  { name: 'Köln Hauptbahnhof', kind: 'station', lat: 50.943, lon: 6.9589, address: 'Trankgasse 11, 50667 Köln' },
  { name: 'Bahnhof Köln-Ehrenfeld', kind: 'station', lat: 50.9519, lon: 6.9173, address: 'Venloer Str., 50823 Köln' },
  { name: 'Köln Messe/Deutz', kind: 'station', lat: 50.9407, lon: 6.9739, address: 'Ottoplatz, 50679 Köln' },
  { name: 'Polizeipräsidium Köln', kind: 'police', lat: 50.9456, lon: 7.0131, address: 'Walter-Pauli-Ring 2-6, 51103 Köln' },
  { name: 'A&O Köln Hauptbahnhof', kind: 'hostel', lat: 50.942, lon: 6.954, address: 'Komödienstr. 19-21, 50667 Köln' },
];

const MUNICH: SeedPlace[] = [
  { name: 'Asia Food Markt München', kind: 'grocery', lat: 48.1366, lon: 11.5624, address: 'Schwanthalerstr. 70, 80336 München' },
  { name: 'India Bazar', kind: 'grocery', lat: 48.1443, lon: 11.5612, address: 'Schellingstr., 80799 München' },
  { name: 'Shree Ganesha', kind: 'restaurant', lat: 48.1398, lon: 11.5802, address: 'Theresienstr., 80333 München' },
  { name: 'Sri Shiva Vishnu Tempel', kind: 'temple', lat: 48.1821, lon: 11.5607, address: 'Milbertshofen, 80807 München' },
  { name: 'Kreisverwaltungsreferat (KVR)', kind: 'buergeramt', lat: 48.1312, lon: 11.5668, address: 'Ruppertstr. 19, 80466 München' },
  { name: 'Münchner Volkshochschule', kind: 'language_school', lat: 48.1296, lon: 11.5986, address: 'Einsteinstr. 28, 81675 München' },
  { name: 'Klinikum rechts der Isar', kind: 'doctor', lat: 48.1372, lon: 11.5999, address: 'Ismaninger Str. 22, 81675 München' },
  { name: 'München Hauptbahnhof', kind: 'station', lat: 48.1402, lon: 11.56, address: 'Bayerstr. 10A, 80335 München' },
  { name: 'Marienplatz (S/U-Bahn)', kind: 'station', lat: 48.1374, lon: 11.5755, address: 'Marienplatz, 80331 München' },
  { name: 'Polizeipräsidium München', kind: 'police', lat: 48.1389, lon: 11.5692, address: 'Ettstr. 2, 80333 München' },
  { name: "Wombat's City Hostel Munich", kind: 'hostel', lat: 48.1393, lon: 11.557, address: 'Senefelderstr. 1, 80336 München' },
];

const AACHEN: SeedPlace[] = [
  { name: 'Asia Shop Aachen', kind: 'grocery', lat: 50.7765, lon: 6.0839, address: 'Pontstr., 52062 Aachen' },
  { name: 'Taj Mahal Aachen', kind: 'restaurant', lat: 50.7772, lon: 6.0823, address: 'Pontstr. 141, 52062 Aachen' },
  { name: 'Bürgerservice Aachen', kind: 'buergeramt', lat: 50.7762, lon: 6.0836, address: 'Katschhof, 52058 Aachen' },
  { name: 'Ausländeramt Aachen', kind: 'buergeramt', lat: 50.7696, lon: 6.0905, address: 'Mozartstr. 2, 52064 Aachen' },
  { name: 'VHS Aachen', kind: 'language_school', lat: 50.7731, lon: 6.0856, address: 'Peterstr. 21, 52062 Aachen' },
  { name: 'Uniklinik RWTH Aachen', kind: 'doctor', lat: 50.7765, lon: 6.0459, address: 'Pauwelsstr. 30, 52074 Aachen' },
  { name: 'Aachen Hauptbahnhof', kind: 'station', lat: 50.7681, lon: 6.0915, address: 'Bahnhofplatz 2a, 52064 Aachen' },
  { name: 'Aachen West (closest to RWTH)', kind: 'station', lat: 50.7806, lon: 6.0658, address: 'Turmstr., 52072 Aachen' },
  { name: 'Polizeipräsidium Aachen', kind: 'police', lat: 50.7536, lon: 6.1312, address: 'Trierer Str. 501, 52078 Aachen' },
  { name: 'A&O Aachen Hauptbahnhof', kind: 'hostel', lat: 50.7667, lon: 6.093, address: 'Hackländerstr. 5, 52064 Aachen' },
];

const DARMSTADT: SeedPlace[] = [
  { name: 'Asia Markt Darmstadt', kind: 'grocery', lat: 49.8726, lon: 8.6504, address: 'Schulstr., 64283 Darmstadt' },
  { name: 'Namaste India', kind: 'restaurant', lat: 49.8731, lon: 8.6538, address: 'Kasinostr., 64293 Darmstadt' },
  { name: 'Bürgerbüro Darmstadt', kind: 'buergeramt', lat: 49.8714, lon: 8.6519, address: 'Luisenplatz 5A, 64283 Darmstadt' },
  { name: 'VHS Darmstadt', kind: 'language_school', lat: 49.8744, lon: 8.6475, address: 'Justus-Liebig-Haus, 64283 Darmstadt' },
  { name: 'Klinikum Darmstadt', kind: 'doctor', lat: 49.8792, lon: 8.6392, address: 'Grafenstr. 9, 64283 Darmstadt' },
  { name: 'Darmstadt Hauptbahnhof', kind: 'station', lat: 49.8725, lon: 8.6294, address: 'Am Hauptbahnhof 1, 64293 Darmstadt' },
  { name: 'Polizeipräsidium Südhessen', kind: 'police', lat: 49.8537, lon: 8.6531, address: 'Klappacher Str. 145, 64285 Darmstadt' },
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

/** The kinds this list can actually answer for, so a caller can tell a gap from an outage. */
export const SEEDED_KINDS = [...new Set(Object.values(BY_CITY).flat().map((p) => p.kind))];
