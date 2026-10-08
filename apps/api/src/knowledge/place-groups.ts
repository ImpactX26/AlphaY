/**
 * What to look for around somebody's new address.
 *
 * Two things use this list and they used to disagree: the Life page drew a map from one set of
 * categories, and a question in the chat ("is there an Indian shop near me?") reached none of them
 * at all. One list, one source of truth, and each group carries the phrasing that should select it
 * so a question in the chat and a pin on the map are answered from the same lookup.
 *
 * The categories are chosen from what people actually ask in the first month, in roughly the order
 * they ask it. The Bürgeramt is on the list because registering within two weeks is a legal
 * obligation nobody tells you about; the police station is on it because knowing where it is costs
 * nothing and is worth a great deal on one particular evening.
 */
export interface PlaceGroup {
  kind: string;
  label: string;
  /** Overpass selectors, tried together. */
  filters: string[];
  /** How somebody refers to this in a sentence. */
  match: RegExp;
  /** On the map by default, or only when asked. Six categories is a map; twelve is a mess. */
  primary: boolean;
}

export const PLACE_GROUPS: PlaceGroup[] = [
  {
    kind: 'grocery',
    label: 'Indian and Asian groceries',
    filters: [
      '["shop"]["cuisine"~"indian|asian",i]',
      '["shop"]["origin"~"indian|asian",i]',
      '["shop"~"supermarket|convenience|deli|greengrocer|food"]["name"~"India|Indian|Asia|Desi|Bazaar|Spice|Masala",i]',
    ],
    match: /\b(indian (shop|store|grocer\w*)|asian (shop|store|supermarket)|grocer\w*|groceries|spice|masala|where do i (shop|buy))\b/i,
    primary: true,
  },
  {
    kind: 'supermarket',
    label: 'Supermarkets',
    filters: ['["shop"~"supermarket|convenience"]'],
    match: /\b(supermarket|rewe|aldi|lidl|edeka|penny|where (can|do) i buy food|weekly shop)\b/i,
    primary: false,
  },
  {
    kind: 'restaurant',
    label: 'Indian restaurants',
    filters: ['["amenity"~"restaurant|fast_food"]["cuisine"~"indian",i]'],
    match: /\b(restaurants?|indian food|eat out|takeaway)\b/i,
    primary: true,
  },
  {
    kind: 'temple',
    label: 'Temples and gurdwaras',
    filters: ['["amenity"="place_of_worship"]["religion"~"hindu|sikh"]'],
    match: /\b(temple|mandir|gurdwara|puja|hindu|sikh)\b/i,
    primary: true,
  },
  {
    kind: 'church',
    label: 'Churches with Indian services',
    filters: ['["amenity"="place_of_worship"]["denomination"~"syro|malankara|orthodox|catholic",i]["name"~"Indian|Malayalam|Syro|Kerala|St. Thomas",i]'],
    match: /\b(church|mass|syro|malankara|malayalam service)\b/i,
    primary: false,
  },
  {
    kind: 'buergeramt',
    label: 'Bürgeramt (Anmeldung)',
    filters: ['["amenity"="townhall"]["name"~"Bürgeramt|Bürgerbüro|Bürgerservice|Kundenzentrum",i]', '["office"="government"]["government"="public_service"]'],
    match: /\b(bürgeramt|buergeramt|burgeramt|rathaus|anmeldung|register|town hall|ausländerbehörde|auslanderbehorde)\b/i,
    primary: true,
  },
  {
    kind: 'station',
    label: 'Trains, trams and the U-Bahn',
    filters: ['["railway"~"station|halt"]', '["public_transport"="station"]', '["railway"="tram_stop"]'],
    match: /\b(station|bahnhof|u-?bahn|s-?bahn|tram|train|metro|public transport|how do i get (to|around))\b/i,
    primary: true,
  },
  {
    kind: 'pharmacy',
    label: 'Pharmacies (Apotheke)',
    filters: ['["amenity"="pharmacy"]'],
    match: /\b(pharmacy|apotheke|chemist|medicine|tablets|prescription)\b/i,
    primary: true,
  },
  {
    kind: 'doctor',
    label: 'Doctors and hospitals',
    filters: ['["amenity"~"doctors|hospital|clinic"]'],
    match: /\b(doctor|arzt|hospital|krankenhaus|clinic|gp|emergency|unwell|sick)\b/i,
    primary: false,
  },
  {
    kind: 'police',
    label: 'Police stations',
    filters: ['["amenity"="police"]'],
    match: /\b(police|polizei|report a (crime|theft)|stolen|unsafe)\b/i,
    primary: false,
  },
  {
    kind: 'hostel',
    label: 'Hostels and cheap first nights',
    filters: ['["tourism"~"hostel|guest_house"]', '["tourism"="hotel"]["stars"~"1|2"]'],
    match: /\b(hostel|guest ?house|first night|somewhere to stay|temporary (place|accommodation)|cheap hotel)\b/i,
    primary: false,
  },
  {
    kind: 'language_school',
    label: 'German courses (VHS)',
    filters: ['["amenity"="school"]["name"~"Volkshochschule|VHS|Sprachschule",i]', '["office"="educational_institution"]'],
    match: /\b(language school|german (course|class)|vhs|volkshochschule|sprachschule|learn german)\b/i,
    primary: false,
  },
  {
    kind: 'bank',
    label: 'Banks',
    filters: ['["amenity"="bank"]'],
    match: /\b(bank|open an account|girokonto|atm|cash machine)\b/i,
    primary: false,
  },
  {
    kind: 'gym',
    label: 'Gyms and sports',
    filters: ['["leisure"~"fitness_centre|sports_centre"]'],
    match: /\b(gym|fitness|sports centre|swimming)\b/i,
    primary: false,
  },
];

/** The six that go on the map without being asked. */
export const PRIMARY_GROUPS = PLACE_GROUPS.filter((g) => g.primary);

/**
 * Which category a sentence is asking about.
 *
 * Returns the groups in list order rather than a single best guess, because "is there an Indian
 * shop or restaurant nearby" is one question with two answers and picking one of them is worse than
 * answering both.
 */
export function groupsForQuestion(text: string): PlaceGroup[] {
  const t = text ?? '';
  const hits = PLACE_GROUPS.filter((g) => g.match.test(t));
  // "What is around me?" names nothing in particular, and the honest reading of it is the map.
  return hits.length ? hits.slice(0, 3) : PRIMARY_GROUPS;
}
