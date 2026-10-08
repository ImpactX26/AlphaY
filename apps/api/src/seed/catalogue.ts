import { config } from '../config';

const mock = (slug: string) => `${config.apiUrl}/api/mock/${slug}`;

/**
 * The seeded programme catalogue, pointing at the universities' own pages.
 *
 * No curated requirements. The agent opens the real page in the run, reads what it says and quotes
 * it — which is the only version of this that is actually true. A hand-written table would have
 * been steadier on stage and worth nothing, because the whole claim of the product is that it read
 * the page rather than that somebody typed the answer in beforehand.
 *
 * `fallbackSlug` is a stand-in served from /api/mock, used only when the real page cannot be
 * reached and nothing is cached. Hotel wifi should degrade the demo, not end it.
 */
export interface SeedProgramme {
  title: string;
  university: string;
  city: string;
  url: string;
  fallbackSlug: string;
  degree: string;
  language: string;
  field: string;
}

export const PROGRAMMES: SeedProgramme[] = [
  {
    title: 'M.Sc. Data Science',
    university: 'RWTH Aachen University',
    city: 'Aachen',
    url: 'https://sc.informatik.rwth-aachen.de/en/studium/master/master-data-science/application-for-admission/',
    fallbackSlug: 'rwth-aachen-msc-data-science',
    degree: 'master',
    language: 'english',
    field: 'data science',
  },
  {
    title: 'M.Sc. Informatics',
    university: 'Technical University of Munich',
    city: 'Munich',
    url: 'https://www.cit.tum.de/en/cit/studies/degree-programs/master-informatics',
    fallbackSlug: 'tum-msc-informatics',
    degree: 'master',
    language: 'english',
    field: 'computer science',
  },
  {
    title: 'M.Sc. Autonomous Systems and Robotics',
    university: 'Technical University of Darmstadt',
    city: 'Darmstadt',
    url: 'https://www.informatik.tu-darmstadt.de/studium_fb20/im_studium/studiengaenge_liste/asur_msc.en.jsp',
    fallbackSlug: 'tu-darmstadt-msc-autonomous-systems',
    degree: 'master',
    language: 'english',
    field: 'robotics',
  },
];

export const PROGRAMME_ROWS = PROGRAMMES.map((p) => ({
  title: p.title,
  university: p.university,
  city: p.city,
  url: p.url,
  degree: p.degree,
  language: p.language,
  field: p.field,
  data: { fallbackUrl: mock(p.fallbackSlug) } as Record<string, unknown>,
}));

export const OPENINGS = [
  {
    employer: 'Klinikum Köln-Mitte',
    employerEmail: 'pflege@klinikum-koeln-mitte.demo',
    title: 'Pflegefachkraft (m/w/d), general medicine and surgical wards',
    city: 'Cologne',
    route: 'nursing',
    germanLevel: 'B1',
    startDate: '2027-09-01',
    needsRecognition: true,
    description:
      'Permanent contract under TVöD-P, pay group P7, about EUR 3,300 gross at entry. The hospital pays the recognition procedure and the adaptation course, provides a furnished room for six months and a paid B2 course in Cologne. Requires a nursing qualification of at least three years, home-country registration, B1 on arrival and B2 within twelve months.',
  },
  {
    employer: 'Seniorenzentrum Rheinbogen',
    employerEmail: 'bewerbung@rheinbogen.demo',
    title: 'Pflegefachkraft (m/w/d), elderly care',
    city: 'Düsseldorf',
    route: 'nursing',
    germanLevel: 'B2',
    startDate: '2027-04-01',
    needsRecognition: true,
    description: 'Elderly care home with 120 residents. Permanent contract, EUR 3,100 gross, shift bonuses. B2 required at the start because residents speak only German. Recognition must be complete or in the adaptation phase.',
  },
  {
    employer: 'Universitätsklinikum Aachen',
    employerEmail: 'ausbildung@uk-aachen.demo',
    title: 'Ausbildung Pflegefachfrau/-mann (3 years)',
    city: 'Aachen',
    route: 'ausbildung',
    germanLevel: 'B1',
    startDate: '2027-10-01',
    needsRecognition: false,
    description:
      'Three-year vocational training leading to the German nursing qualification, so no recognition procedure is needed afterwards. Training salary EUR 1,340 in the first year. Requires Class 12, B1 German at the start and a willingness to reach B2 during the training.',
  },
];

/** Links the Discord bot posts into the cohort channel. */
export const DISCORD_LINKS = [
  { label: 'M.Sc. Data Science — RWTH Aachen', url: PROGRAMMES[0].url, tag: 'study' },
  { label: 'M.Sc. Informatics — TU Munich', url: PROGRAMMES[1].url, tag: 'study' },
  { label: 'M.Sc. Autonomous Systems — TU Darmstadt', url: PROGRAMMES[2].url, tag: 'study' },
  { label: 'APS certificate: how and when to apply', url: mock('aps-india'), tag: 'study' },
  { label: 'Applying through uni-assist from India', url: mock('uni-assist'), tag: 'study' },
  { label: 'Student visa: the blocked account amount', url: mock('student-visa-finance'), tag: 'visa' },
  { label: 'Recognition of a foreign nursing qualification', url: mock('anerkennung-nursing'), tag: 'nursing' },
  { label: 'Pflegefachkraft in Cologne, start September 2027', url: mock('klinikum-koeln-pflegefachkraft'), tag: 'nursing' },
  { label: 'German courses: how long A1 to B1 really takes', url: mock('german-courses-levels'), tag: 'german' },
  { label: 'Opportunity Card: the points table', url: mock('opportunity-card'), tag: 'jobs' },
];
