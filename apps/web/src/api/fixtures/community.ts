import type { CohortDTO, CommunityPostDTO, RentalsBlock } from '@educaro/shared';

const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

/**
 * Rooms and flats around the Ehrenfeld clinic Ananya is heading to.
 *
 * Real Cologne districts and coordinates, with warm rents in the range those districts actually
 * ask. The two over-budget rows are deliberate: a block where everything is affordable would not
 * show what the colour means, and the cheapest room here is also the longest commute.
 */
export function rentalsFor(city: string): RentalsBlock {
  return {
    id: 'b-rentals',
    type: 'rentals',
    title: `Where you could live in ${city}`,
    body: 'Warm rent includes heating and service charges. The commute is door to door by tram or S-Bahn, not straight-line distance.',
    city,
    center: { lat: 50.9487, lon: 6.9253 },
    anchor: { label: 'Rheinpflege Seniorenzentrum', lat: 50.9512, lon: 6.9179 },
    budgetEur: 620,
    source: 'Listings from WG-Gesucht and ImmoScout24, read on 8 October.',
    listings: [
      {
        id: 'r-ehrenfeld-wg',
        title: 'Room in a three-person flat',
        district: 'Ehrenfeld',
        kind: 'wg_room',
        warmRentEur: 480,
        sizeSqm: 16,
        lat: 50.9503,
        lon: 6.9174,
        commuteMin: 9,
        url: 'https://www.wg-gesucht.de/',
        affordable: true,
        note: 'Two nurses already live there',
      },
      {
        id: 'r-bickendorf-studio',
        title: 'Studio with a small kitchen',
        district: 'Bickendorf',
        kind: 'studio',
        warmRentEur: 595,
        sizeSqm: 28,
        lat: 50.9601,
        lon: 6.8988,
        commuteMin: 17,
        url: 'https://www.immobilienscout24.de/',
        affordable: true,
      },
      {
        id: 'r-nippes-wg',
        title: 'Room in a shared flat near the market',
        district: 'Nippes',
        kind: 'wg_room',
        warmRentEur: 430,
        sizeSqm: 14,
        lat: 50.9686,
        lon: 6.9512,
        commuteMin: 34,
        url: 'https://www.wg-gesucht.de/',
        affordable: true,
        note: 'Cheapest here, and the longest journey',
      },
      {
        id: 'r-sulz-flat',
        title: 'One-bedroom flat',
        district: 'Sülz',
        kind: 'flat',
        warmRentEur: 890,
        sizeSqm: 45,
        lat: 50.9214,
        lon: 6.9289,
        commuteMin: 28,
        url: 'https://www.immobilienscout24.de/',
        affordable: false,
        note: 'Over your budget on one salary',
      },
      {
        id: 'r-altstadt-studio',
        title: 'Studio in the old town',
        district: 'Altstadt-Nord',
        kind: 'studio',
        warmRentEur: 760,
        sizeSqm: 24,
        lat: 50.9413,
        lon: 6.9583,
        commuteMin: 21,
        url: null,
        affordable: false,
      },
    ],
  };
}

/**
 * What the nursing route actually took the people ahead of her.
 *
 * `basis` is 9 so the block shows a real count rather than a confident-looking line drawn through
 * three files. The ranges are wide on purpose: recognition genuinely varies by Bundesland.
 */
export const nursingCohort: CohortDTO = {
  route: 'nursing',
  basis: 9,
  steps: [
    { label: 'Papers gathered and read', medianWeeks: 3, rangeWeeks: [1, 7], youAre: 'ahead' },
    { label: 'German to B1', medianWeeks: 22, rangeWeeks: [16, 34], youAre: 'behind' },
    { label: 'Anerkennung filed and decided', medianWeeks: 18, rangeWeeks: [11, 30], youAre: 'not_started' },
    { label: 'Employer found and contract signed', medianWeeks: 7, rangeWeeks: [3, 16], youAre: 'on_track' },
    { label: 'Visa appointment to arrival', medianWeeks: 10, rangeWeeks: [6, 19], youAre: 'not_started' },
  ],
  peers: [
    { label: 'GNM nurse, Kerala', headline: 'B1 in five months while working nights', nowAt: 'In Cologne' },
    { label: 'BSc nurse, Tamil Nadu', headline: 'Anerkennung came back asking for an adaptation course', nowAt: 'Adaptation, month 2' },
    { label: 'GNM nurse, Kerala', headline: 'Name mismatch on the diploma, fixed with an affidavit', nowAt: 'Visa booked' },
  ],
};

/** The cohort thread. The Discord-sourced posts are the ones the bot mirrored in. */
export const communityPosts: CommunityPostDTO[] = [
  {
    id: 'cp-1',
    channel: 'koeln-pflege-sep27',
    author: 'Educaro agent',
    authorKind: 'agent',
    applicantId: null,
    text: 'Welcome to the September 2027 Cologne cohort. Nine of you are on the nursing route. Ask anything here — someone has usually hit it already.',
    viaDiscord: false,
    replies: [],
    createdAt: ago(2880),
  },
  {
    id: 'cp-2',
    channel: 'koeln-pflege-sep27',
    author: 'Meera T.',
    authorKind: 'applicant',
    applicantId: 'app-meera',
    text: 'The Anerkennung office asked for a certified translation of my diploma, not just a copy. Has anyone used a translator in Kochi they would recommend?',
    viaDiscord: true,
    replies: [],
    createdAt: ago(420),
  },
  {
    id: 'cp-3',
    channel: 'koeln-pflege-sep27',
    author: 'Priya M.',
    authorKind: 'applicant',
    applicantId: 'app-priya',
    text: 'Yes — the one near the KNMC office does sworn translations and the Bezirksregierung accepted mine without a question.',
    viaDiscord: true,
    replies: [],
    createdAt: ago(395),
  },
  {
    id: 'cp-4',
    channel: 'koeln-pflege-sep27',
    author: 'Lena F.',
    authorKind: 'staff',
    applicantId: null,
    text: 'Adding to that: get the translation done before you file, not after. A file that arrives incomplete goes to the back of the queue and that costs about six weeks.',
    viaDiscord: false,
    replies: [],
    createdAt: ago(300),
  },
];
