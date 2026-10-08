import { CITIES, DEFAULT_CITY, findCity, type CityInfo } from '../../knowledge/cities';
import { monthlyBudget, netPay } from '../../knowledge/money';
import { OFFICIAL } from '../../knowledge/official';
import { bestFact, type ApplicantState } from '../state.service';
import { cite, type Kit, type SpecialistResult } from './kit';

/** The city this applicant is planning around: Germany address, shortlist, family, preference, then default. */
export function targetCity(state: ApplicantState): CityInfo {
  const a = state.applicant;
  return (
    findCity(a.targetCity) ??
    findCity(state.shortlist[0]?.subtitle) ??
    findCity((bestFact(state, 'family.germany')?.data as any)?.city) ??
    findCity(bestFact(state, 'goal.city')?.value) ??
    DEFAULT_CITY
  );
}

const GROSS_BY_ROUTE: Record<string, { gross: number; label: string }> = {
  nursing: { gross: 3100, label: 'Nurse during recognition (typical start)' },
  ausbildung: { gross: 1150, label: 'Ausbildung pay, first year (typical)' },
  skilled_job: { gross: 4200, label: 'Skilled worker (typical start)' },
  chancenkarte: { gross: 0, label: '' },
};

/** Money: monthly budget, blocked account or salary, net pay, scholarships. */
export async function moneySpecialist(kit: Kit): Promise<SpecialistResult> {
  const route = kit.state.applicant.route ?? 'skilled_job';
  const city = targetCity(kit.state);
  const student = route === 'study';
  const budget = monthlyBudget(city, student ? 'student' : 'worker');
  const cited = await Promise.all([cite(kit, 'deutschlandticket'), cite(kit, 'rundfunk'), student ? cite(kit, 'blocked_account') : null, student ? cite(kit, 'student_health') : null]);
  const compareCities = kit.state.shortlist.length
    ? [...new Set(kit.state.shortlist.map((s) => findCity(s.subtitle)?.name).filter(Boolean))].map((n) => CITIES.find((c) => c.name === n)!)
    : CITIES.filter((c) => c.name !== city.name).slice(0, 2);
  const compare = compareCities.map((c) => ({ city: c.name, total: monthlyBudget(c, student ? 'student' : 'worker').total }));
  const gross = GROSS_BY_ROUTE[route];
  const pay = gross?.gross ? { ...netPay(gross.gross), label: gross.label } : null;
  const output = {
    city: city.name,
    lines: budget.lines,
    total: budget.total,
    compare,
    pay,
    blockedAccount: student ? { value: OFFICIAL.blocked_account.value, monthly: OFFICIAL.blocked_account.amount } : null,
    scholarships: student ? [{ label: 'DAAD scholarship database', url: 'https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/' }] : [],
    sources: cited.filter(Boolean).map((c) => ({ label: c!.label, url: c!.url, tag: c!.tag })),
    rentSource: city.rentSource,
  };
  return { summary: `Money: about €${budget.total}/month in ${city.name}${pay ? `; net pay about €${Math.round(pay.net)}` : ''}`, output };
}

/** Housing: realistic rent by type, districts, scam warnings, the landlord form Anmeldung needs. */
export async function housingSpecialist(kit: Kit): Promise<SpecialistResult> {
  const city = targetCity(kit.state);
  return {
    summary: `Housing: WG room about €${city.wgRoom}, studio about €${city.studio} in ${city.name}`,
    output: {
      city: city.name,
      options: [
        { type: 'Room in a shared flat (WG)', rent: city.wgRoom },
        { type: 'Small studio', rent: city.studio },
        { type: 'Student residence (Studierendenwerk)', rent: Math.round(city.wgRoom * 0.7) },
      ],
      districts: city.districts,
      scams: [
        'Never pay a deposit before seeing the flat or signing a contract',
        'Landlords abroad who ask for money by Western Union are scams',
        'The deposit (Kaution) is at most three months of cold rent',
      ],
      anmeldung: 'Ask the landlord for the "Wohnungsgeberbestätigung". The Bürgeramt needs it for Anmeldung.',
      portals: [
        { label: 'WG-Gesucht', url: 'https://www.wg-gesucht.de/en/' },
        { label: 'Studierendenwerk housing', url: 'https://www.studierendenwerke.de/' },
      ],
    },
  };
}

const PLACE_GROUPS: { kind: string; label: string; filters: string[] }[] = [
  {
    kind: 'grocery',
    label: 'Indian and Asian groceries',
    filters: ['["shop"]["cuisine"~"indian|asian",i]', '["shop"]["origin"~"indian|asian",i]', '["shop"~"supermarket|convenience|deli|greengrocer|food"]["name"~"India|Indian|Asia|Desi|Bazaar|Spice|Masala",i]'],
  },
  { kind: 'restaurant', label: 'Indian restaurants', filters: ['["amenity"~"restaurant|fast_food"]["cuisine"~"indian",i]'] },
  { kind: 'temple', label: 'Temples and gurdwaras', filters: ['["amenity"="place_of_worship"]["religion"~"hindu|sikh"]'] },
  { kind: 'church', label: 'Churches with Indian services', filters: ['["amenity"="place_of_worship"]["denomination"~"syro|malankara|orthodox|catholic",i]["name"~"Indian|Malayalam|Syro|Kerala|St. Thomas",i]'] },
  {
    kind: 'buergeramt',
    label: 'Bürgeramt (Anmeldung)',
    filters: ['["amenity"="townhall"]["name"~"Bürgeramt|Bürgerbüro|Bürgerservice|Kundenzentrum",i]', '["office"="government"]["government"="public_service"]'],
  },
];

/** Life in Germany: places near the new address from OpenStreetMap, plus the arrival checklist. */
export async function lifeSpecialist(kit: Kit): Promise<SpecialistResult> {
  const city = targetCity(kit.state);
  let center = { lat: city.lat, lon: city.lon };
  const addr = kit.state.applicant.germanyAddress;
  if (addr) center = (await kit.web.geocode(`${addr}, ${city.name}`, { runId: kit.runId, applicantId: kit.applicantId })) ?? center;
  const radius = addr ? 4000 : 6000;
  const groups = [];
  for (const g of PLACE_GROUPS) {
    const places = await kit.web.placesNearby(center.lat, center.lon, g.filters, radius, { runId: kit.runId, applicantId: kit.applicantId });
    groups.push({ kind: g.kind, label: g.label, places: places.slice(0, 6) });
  }
  const winter = ['Winter jacket rated below 0 °C', 'Waterproof shoes', 'Thermal layers', 'Gloves and a hat'];
  const arrival = [
    { title: 'Before the flight', items: ['Passport, visa and printed papers in hand luggage', 'Health insurance confirmed', 'Address for the first night', ...winter.slice(0, 2)] },
    { title: 'First two weeks', items: ['Anmeldung at the Bürgeramt (bring the Wohnungsgeberbestätigung)', 'SIM card', 'Bank account', 'Health insurance card', 'Deutschlandticket', 'Tax ID arrives by post after Anmeldung'] },
    { title: 'First month', items: ['First payslip explained line by line', 'Join the city Discord channel', 'Educaro intercultural workshop'] },
  ];
  const found = groups.reduce((s, g) => s + g.places.length, 0);
  return { summary: `Life in ${city.name}: ${found} places found near ${addr ? 'the new address' : 'the centre'}`, output: { city: city.name, center, groups, arrival, source: 'OpenStreetMap (Overpass API)' } };
}
