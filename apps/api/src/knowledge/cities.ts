/**
 * City data for budgets, housing and maps. Rents are average monthly warm rents for a shared-flat (WG) room
 * and a small studio. They are estimates and are always shown as such, with the source.
 */
export interface CityInfo {
  name: string;
  aliases: string[];
  state: string;
  lat: number;
  lon: number;
  wgRoom: number;
  studio: number;
  districts: string[];
  rentSource: string;
}

export const CITIES: CityInfo[] = [
  { name: 'Cologne', aliases: ['köln', 'koln', 'cologne'], state: 'North Rhine-Westphalia', lat: 50.9375, lon: 6.9603, wgRoom: 580, studio: 850, districts: ['Ehrenfeld', 'Sülz', 'Kalk', 'Mülheim', 'Nippes'], rentSource: 'MLP Student Housing Report / Moses Mendelssohn Institute' },
  { name: 'Munich', aliases: ['münchen', 'munchen', 'munich'], state: 'Bavaria', lat: 48.1374, lon: 11.5755, wgRoom: 800, studio: 1200, districts: ['Garching', 'Freimann', 'Moosach', 'Neuperlach', 'Schwabing'], rentSource: 'MLP Student Housing Report / Moses Mendelssohn Institute' },
  { name: 'Aachen', aliases: ['aachen'], state: 'North Rhine-Westphalia', lat: 50.7753, lon: 6.0839, wgRoom: 450, studio: 650, districts: ['Ponttor', 'Burtscheid', 'Frankenberger Viertel', 'Laurensberg'], rentSource: 'MLP Student Housing Report / Moses Mendelssohn Institute' },
  { name: 'Darmstadt', aliases: ['darmstadt'], state: 'Hesse', lat: 49.8728, lon: 8.6512, wgRoom: 550, studio: 800, districts: ['Martinsviertel', 'Bessungen', 'Kranichstein', 'Lichtwiese'], rentSource: 'MLP Student Housing Report / Moses Mendelssohn Institute' },
  { name: 'Berlin', aliases: ['berlin'], state: 'Berlin', lat: 52.52, lon: 13.405, wgRoom: 650, studio: 1000, districts: ['Neukölln', 'Wedding', 'Lichtenberg', 'Friedrichshain', 'Moabit'], rentSource: 'MLP Student Housing Report / Moses Mendelssohn Institute' },
  { name: 'Düsseldorf', aliases: ['düsseldorf', 'dusseldorf', 'duesseldorf'], state: 'North Rhine-Westphalia', lat: 51.2277, lon: 6.7735, wgRoom: 560, studio: 850, districts: ['Bilk', 'Flingern', 'Oberbilk', 'Pempelfort'], rentSource: 'MLP Student Housing Report / Moses Mendelssohn Institute' },
  { name: 'Frankfurt', aliases: ['frankfurt', 'frankfurt am main'], state: 'Hesse', lat: 50.1109, lon: 8.6821, wgRoom: 700, studio: 1050, districts: ['Bockenheim', 'Bornheim', 'Rödelheim', 'Sachsenhausen'], rentSource: 'MLP Student Housing Report / Moses Mendelssohn Institute' },
  { name: 'Hamburg', aliases: ['hamburg'], state: 'Hamburg', lat: 53.5511, lon: 9.9937, wgRoom: 650, studio: 1000, districts: ['Barmbek', 'Wilhelmsburg', 'Eimsbüttel', 'Harburg'], rentSource: 'MLP Student Housing Report / Moses Mendelssohn Institute' },
  { name: 'Stuttgart', aliases: ['stuttgart'], state: 'Baden-Württemberg', lat: 48.7758, lon: 9.1829, wgRoom: 650, studio: 950, districts: ['Vaihingen', 'Bad Cannstatt', 'Feuerbach', 'Zuffenhausen'], rentSource: 'MLP Student Housing Report / Moses Mendelssohn Institute' },
  { name: 'Bonn', aliases: ['bonn'], state: 'North Rhine-Westphalia', lat: 50.7374, lon: 7.0982, wgRoom: 520, studio: 780, districts: ['Poppelsdorf', 'Endenich', 'Beuel', 'Bad Godesberg'], rentSource: 'MLP Student Housing Report / Moses Mendelssohn Institute' },
];

export function findCity(name: string | null | undefined): CityInfo | null {
  if (!name) return null;
  const n = name.toLowerCase();
  return CITIES.find((c) => c.aliases.some((a) => n.includes(a))) ?? null;
}

export const DEFAULT_CITY = CITIES[0];
