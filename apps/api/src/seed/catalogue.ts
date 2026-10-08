import { config } from '../config';
import type { Requirements } from '../agent/shortlist.service';

const mock = (slug: string) => `${config.apiUrl}/api/mock/${slug}`;

/**
 * The seeded programme catalogue. Every quote below is copied verbatim from the matching page in
 * src/mockweb/pages.ts, so the "no source, no save" guard passes honestly: the agent opens the
 * page in the run, finds the quote on it, and only then writes a Web fact.
 */
export interface SeedProgramme {
  title: string;
  university: string;
  city: string;
  slug: string;
  degree: string;
  language: string;
  field: string;
  requirements: Requirements;
}

export const PROGRAMMES: SeedProgramme[] = [
  {
    title: 'M.Sc. Data Science',
    university: 'RWTH Aachen University',
    city: 'Aachen',
    slug: 'rwth-aachen-msc-data-science',
    degree: 'master',
    language: 'english',
    field: 'data science',
    requirements: {
      title: 'M.Sc. Data Science',
      university: 'RWTH Aachen University',
      city: 'Aachen',
      teachingLanguage: 'english',
      degree: { value: 'Bachelor in computer science, mathematics, statistics or a close subject, 180 ECTS', quote: 'Bachelor degree in computer science, mathematics, statistics or a closely related subject with at least 180 ECTS credits' },
      minGrade: { value: 2.5, quote: 'A final grade of at least 2.5 on the German grading scale is required' },
      english: { ielts: 6.5, toefl: 90, quote: 'IELTS Academic with an overall band of 6.5, or TOEFL iBT 90, are accepted' },
      german: { value: 'none required', quote: 'No proof of German is required for admission' },
      gre: { required: false, quote: 'GRE is not required for this programme' },
      applicationRoute: { value: 'uni-assist, with the APS certificate', quote: 'must apply through uni-assist and must enclose the APS certificate' },
      deadline: { date: '2027-03-01', text: '1 March for the winter semester', quote: 'deadline for the winter semester is 1 March for applicants who need a visa' },
      fees: { value: 'No tuition fees; EUR 330 semester contribution', quote: 'There are no tuition fees. The semester contribution is EUR 330 per semester' },
      keywords: ['machine learning', 'statistics', 'data mining', 'distributed systems', 'visualisation', 'ethics of data'],
    },
  },
  {
    title: 'M.Sc. Informatics',
    university: 'Technical University of Munich',
    city: 'Munich',
    slug: 'tum-msc-informatics',
    degree: 'master',
    language: 'english',
    field: 'computer science',
    requirements: {
      title: 'M.Sc. Informatics',
      university: 'Technical University of Munich',
      city: 'Munich',
      teachingLanguage: 'english',
      degree: { value: 'Bachelor in informatics or equivalent, 180 ECTS', quote: 'A Bachelor degree in informatics or an equivalent subject with at least 180 ECTS credits is required' },
      minGrade: { value: 2.3, quote: 'Applicants must reach a final grade of 2.3 or better on the German grading scale' },
      english: { ielts: 6.5, toefl: 88, quote: 'English proficiency must be proven with IELTS 6.5, TOEFL iBT 88' },
      german: { value: 'none required', quote: 'German is not required for admission to this programme' },
      gre: null,
      applicationRoute: { value: 'TUM application portal, APS certificate mandatory', quote: 'must submit an APS certificate with the application' },
      deadline: { date: '2027-05-31', text: '31 May for the winter semester', quote: 'The deadline for the winter semester is 31 May' },
      fees: { value: 'No tuition fees; EUR 85 student union fee', quote: 'There are no tuition fees for the Master programme. The student union fee is EUR 85 per semester' },
      keywords: ['algorithms', 'machine learning', 'computer vision', 'robotics', 'databases', 'software engineering'],
    },
  },
  {
    title: 'M.Sc. Autonomous Systems',
    university: 'Technical University of Darmstadt',
    city: 'Darmstadt',
    slug: 'tu-darmstadt-msc-autonomous-systems',
    degree: 'master',
    language: 'english',
    field: 'robotics',
    requirements: {
      title: 'M.Sc. Autonomous Systems',
      university: 'Technical University of Darmstadt',
      city: 'Darmstadt',
      teachingLanguage: 'english',
      degree: { value: 'Bachelor in CS, electrical engineering or mechatronics, 180 ECTS', quote: 'A Bachelor degree in computer science, electrical engineering or mechatronics with at least 180 ECTS credits' },
      minGrade: { value: 2.7, quote: 'A final grade of at least 2.7 on the German grading scale' },
      english: { ielts: 6.0, toefl: 80, quote: 'IELTS 6.0 overall or TOEFL iBT 80 are accepted' },
      german: { value: 'none required', quote: 'No German language certificate is required for admission' },
      gre: null,
      applicationRoute: { value: 'uni-assist, with the APS certificate', quote: 'apply through uni-assist and must enclose the APS certificate' },
      deadline: { date: '2027-07-15', text: '15 July for the winter semester', quote: 'The application deadline for the winter semester is 15 July' },
      fees: { value: 'No tuition fees; EUR 283 semester fee with a transport ticket', quote: 'No tuition fees are charged. The semester fee is EUR 283' },
      keywords: ['robotics', 'reinforcement learning', 'computer vision', 'sensor fusion', 'real-time systems'],
    },
  },
];

export const PROGRAMME_ROWS = PROGRAMMES.map((p) => ({
  title: p.title,
  university: p.university,
  city: p.city,
  url: mock(p.slug),
  degree: p.degree,
  language: p.language,
  field: p.field,
  data: { requirements: p.requirements } as Record<string, unknown>,
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
  { label: 'M.Sc. Data Science — RWTH Aachen', url: mock('rwth-aachen-msc-data-science'), tag: 'study' },
  { label: 'M.Sc. Informatics — TU Munich', url: mock('tum-msc-informatics'), tag: 'study' },
  { label: 'M.Sc. Autonomous Systems — TU Darmstadt', url: mock('tu-darmstadt-msc-autonomous-systems'), tag: 'study' },
  { label: 'APS certificate: how and when to apply', url: mock('aps-india'), tag: 'study' },
  { label: 'Applying through uni-assist from India', url: mock('uni-assist'), tag: 'study' },
  { label: 'Student visa: the blocked account amount', url: mock('student-visa-finance'), tag: 'visa' },
  { label: 'Recognition of a foreign nursing qualification', url: mock('anerkennung-nursing'), tag: 'nursing' },
  { label: 'Pflegefachkraft in Cologne, start September 2027', url: mock('klinikum-koeln-pflegefachkraft'), tag: 'nursing' },
  { label: 'German courses: how long A1 to B1 really takes', url: mock('german-courses-levels'), tag: 'german' },
  { label: 'Opportunity Card: the points table', url: mock('opportunity-card'), tag: 'jobs' },
];
