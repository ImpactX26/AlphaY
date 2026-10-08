/**
 * The demo web.
 *
 * The agent's rule is "no source, no save": a Web fact only survives if the page was really opened
 * in this run and the quote is really on it. Pointing that at the live internet during a 3-minute
 * demo means a flaky network decides whether the product works, and university pages change under
 * you. So we serve our own stand-ins for the handful of pages the demo opens, at /api/mock/<slug>.
 *
 * They are stand-ins, not copies: the wording is ours, the numbers match what the real pages said
 * when we checked them (see research/knowledge.md). Switch any entry's url back to the real one in
 * the catalogue and the same code path works unchanged — that is the point of keeping them honest.
 */

export interface MockPage {
  slug: string;
  site: string;
  title: string;
  /** Paragraphs and bullet lists. A string is a paragraph; an array is a bullet list. */
  body: (string | string[])[];
  updated?: string;
}

export const MOCK_PAGES: MockPage[] = [
  // ------------------------------------------------------------------ universities
  {
    slug: 'rwth-aachen-msc-data-science',
    site: 'RWTH Aachen University',
    title: 'M.Sc. Data Science — Admission requirements',
    updated: '2026-09-02',
    body: [
      'The Master of Science in Data Science is a four-semester programme at RWTH Aachen University. The programme is taught entirely in English.',
      'Admission is competitive and is decided by the examination board on the basis of the documents submitted.',
      'Entry qualification',
      [
        'Applicants must hold a Bachelor degree in computer science, mathematics, statistics or a closely related subject with at least 180 ECTS credits.',
        'A final grade of at least 2.5 on the German grading scale is required.',
        'At least 18 ECTS credits in mathematics, including linear algebra and probability theory, must be documented in the transcript.',
        'Programming experience in at least one language must be documented.',
      ],
      'Language requirements',
      [
        'Proof of English at level C1 is required. IELTS Academic with an overall band of 6.5, or TOEFL iBT 90, are accepted.',
        'No proof of German is required for admission. German is not needed for this programme, but we recommend at least A1 for daily life.',
      ],
      'Application route and deadlines',
      [
        'Applicants with a degree from India must apply through uni-assist and must enclose the APS certificate.',
        'The application deadline for the winter semester is 1 March for applicants who need a visa.',
        'There are no tuition fees. The semester contribution is EUR 330 per semester and includes a public transport ticket.',
      ],
      'GRE is not required for this programme.',
      'Topics covered include machine learning, statistics, data mining, distributed systems, visualisation and ethics of data.',
    ],
  },
  {
    slug: 'tum-msc-informatics',
    site: 'Technical University of Munich',
    title: 'M.Sc. Informatics — Application and admission',
    updated: '2026-08-21',
    body: [
      'The Master of Science in Informatics at the Technical University of Munich is a four-semester programme taught in English. A small number of elective modules are offered in German.',
      'Entry qualification',
      [
        'A Bachelor degree in informatics or an equivalent subject with at least 180 ECTS credits is required.',
        'Applicants must reach a final grade of 2.3 or better on the German grading scale.',
        'Admission runs through the aptitude assessment procedure, which weighs the curricular analysis, the essay and, in the second stage, an interview.',
      ],
      'Language requirements',
      [
        'English proficiency must be proven with IELTS 6.5, TOEFL iBT 88 or an equivalent certificate.',
        'German is not required for admission to this programme.',
      ],
      'Application route and deadlines',
      [
        'Applicants holding an Indian Bachelor degree must submit an APS certificate with the application. Applications without it cannot be processed.',
        'The deadline for the winter semester is 31 May.',
        'There are no tuition fees for the Master programme. The student union fee is EUR 85 per semester.',
      ],
      'Topics covered include algorithms, machine learning, computer vision, robotics, databases and software engineering.',
    ],
  },
  {
    slug: 'tu-darmstadt-msc-autonomous-systems',
    site: 'Technical University of Darmstadt',
    title: 'M.Sc. Autonomous Systems — Requirements',
    updated: '2026-09-11',
    body: [
      'The Master of Science in Autonomous Systems is a four-semester programme at TU Darmstadt, taught in English.',
      'Entry qualification',
      [
        'A Bachelor degree in computer science, electrical engineering or mechatronics with at least 180 ECTS credits.',
        'A final grade of at least 2.7 on the German grading scale.',
        'Documented coursework in control theory or robotics is an advantage but is not mandatory.',
      ],
      'Language requirements',
      [
        'English at B2 level is sufficient. IELTS 6.0 overall or TOEFL iBT 80 are accepted.',
        'No German language certificate is required for admission.',
      ],
      'Application route and deadlines',
      [
        'Applicants with an Indian degree apply through uni-assist and must enclose the APS certificate.',
        'The application deadline for the winter semester is 15 July.',
        'No tuition fees are charged. The semester fee is EUR 283 and includes a transport ticket for the state of Hesse.',
      ],
      'Topics covered include robotics, reinforcement learning, computer vision, sensor fusion and real-time systems.',
    ],
  },

  // ------------------------------------------------------------------ language
  {
    slug: 'german-courses-levels',
    site: 'Educaro Language School',
    title: 'German courses: A1, A2, B1, B2 — pace, price and exams',
    updated: '2026-09-30',
    body: [
      'Our German courses follow the Common European Framework of Reference. Each level is taught as a separate course and ends with an examination you can register for separately.',
      'How long each level takes',
      [
        'A1 takes 13 weeks at 6 hours a week, about 160 lessons in total.',
        'A2 takes 13 weeks and builds directly on A1.',
        'B1 takes 13 weeks. From no German at all, reaching B1 takes about 9 months of continuous study.',
        'B2 takes 16 weeks and is usually taken in Germany, alongside work or training.',
      ],
      'Price',
      [
        'Each level costs EUR 220 for the online evening course, or EUR 320 for the intensive morning course.',
        'The Goethe or telc examination fee is EUR 90 per level and is paid to the examination centre.',
      ],
      'Which level you need',
      [
        'Nursing recognition requires B2 for the professional licence, and B1 is enough to start the recognition file.',
        'An Ausbildung contract normally requires B1 at the start and B2 during the training.',
        'An English-taught Master programme requires no German, but A1 makes daily life much easier.',
      ],
      'A certificate is only valid proof if it comes from Goethe-Institut, telc, ÖSD or TestDaF. Self-assessment is not accepted by any authority.',
    ],
  },

  // ------------------------------------------------------------------ official-style pages
  {
    slug: 'anerkennung-nursing',
    site: 'Recognition in Germany (demo mirror)',
    title: 'Recognition of a foreign nursing qualification',
    updated: '2026-09-18',
    body: [
      'To work as a nurse in Germany you need the professional licence, the Berufserlaubnis or Berufsurkunde, issued by the state where you will work. Working as a nurse without it is not permitted.',
      'What you submit',
      [
        'Your nursing diploma or degree certificate, with the transcript of hours.',
        'Your nursing council registration from your home country.',
        'Proof of German at B2 level for the professional licence.',
        'A certificate of good conduct and a medical fitness certificate.',
        'All documents translated by a sworn translator and legalised or apostilled.',
      ],
      'How the decision works',
      [
        'The recognition office compares your training with the German training and issues a deficit notice if there are differences.',
        'You then either take the knowledge examination, the Kenntnisprüfung, or complete an adaptation course, the Anpassungslehrgang, of up to 12 months.',
        'A three-year Indian GNM diploma is normally assessed as partially equivalent, so an adaptation course or the knowledge examination is required.',
        'The procedure takes three to four months once the file is complete.',
      ],
      'The fee for the recognition procedure is between EUR 100 and EUR 600 depending on the state.',
    ],
  },
  {
    slug: 'student-visa-finance',
    site: 'Germany Visa Information (demo mirror)',
    title: 'Student visa: proof of financial resources',
    updated: '2026-09-05',
    body: [
      'Every applicant for a national visa for study must prove that they can cover their living costs for the first year.',
      'Blocked account',
      [
        'The required amount for a blocked account is EUR 11,904 for twelve months.',
        'That works out at EUR 992 per month, which is the maximum you may withdraw each month.',
        'The account must be opened before the visa appointment and the confirmation must be submitted with the application.',
      ],
      'Alternatives accepted instead of a blocked account',
      [
        'A formal obligation letter, the Verpflichtungserklärung, signed by a person living in Germany at the foreigners authority.',
        'A scholarship confirmation from a recognised funding organisation.',
      ],
      'Other documents',
      [
        'A letter of admission from a German university.',
        'A valid passport, biometric photographs and health insurance cover from the day of arrival.',
        'The visa fee is EUR 75.',
      ],
      'Processing times at the German missions in India are typically 6 to 12 weeks, so apply as early as the admission letter allows.',
    ],
  },
  {
    slug: 'aps-india',
    site: 'APS India (demo mirror)',
    title: 'Academic Evaluation Centre: the APS certificate for Indian students',
    updated: '2026-09-25',
    body: [
      'The Academic Evaluation Centre, known as APS, verifies the academic documents of applicants from India who want to study in Germany.',
      'Since the winter semester 2023, the APS certificate is mandatory for Indian students applying to a German university, and German missions require it for the student visa.',
      'How to apply',
      [
        'Register on the APS India portal and upload your degree certificate, all semester transcripts and your Class 10 and Class 12 marksheets.',
        'Pay the fee of INR 18,000.',
        'Send the attested hard copies to the APS office in New Delhi.',
      ],
      'Processing takes about four to six weeks from the day the complete set of documents arrives. Apply at least three months before your university deadline.',
      'The certificate does not expire and can be used for several university applications.',
    ],
  },
  {
    slug: 'opportunity-card',
    site: 'Make it in Germany (demo mirror)',
    title: 'Opportunity Card (Chancenkarte): the points system',
    updated: '2026-09-14',
    body: [
      'The Opportunity Card is a residence permit for job-seeking. It is granted for up to one year and allows a part-time job of 20 hours a week and trial work of two weeks per employer.',
      'Basic requirements',
      [
        'A foreign degree or a vocational qualification of at least two years, recognised in the country of training.',
        'German at A1 or English at B2.',
        'Proof of means of subsistence, normally a blocked account of EUR 1,091 per month of stay.',
      ],
      'If your qualification is fully recognised in Germany you do not need points at all. Otherwise you need six points from the following list.',
      'Points',
      [
        'Qualification partially recognised, or a regulated profession with a state licence: 4 points.',
        'German language: A2 gives 1 point, B1 gives 2 points, B2 gives 3 points, C1 gives 4 points.',
        'English language at C1 or above: 1 point.',
        'At least two years of professional experience in the last five years: 2 points. At least five years in the last seven years: 3 points.',
        'Age under 35: 2 points. Age 35 to 39: 1 point.',
        'Previous stay in Germany of at least six months: 1 point.',
        'The spouse or partner also fulfils the requirements: 1 point.',
      ],
    ],
  },
  {
    slug: 'uni-assist',
    site: 'uni-assist (demo mirror)',
    title: 'Applying through uni-assist from India',
    updated: '2026-08-30',
    body: [
      'uni-assist checks international applications on behalf of its member universities and forwards the complete ones.',
      'Fees and timing',
      [
        'The handling fee is EUR 75 for the first application in a semester and EUR 30 for each further application in the same semester.',
        'Processing takes two to four weeks after the complete documents and the payment arrive, so submit at least four weeks before the university deadline.',
      ],
      'What Indian applicants send',
      [
        'Certified copies of the degree certificate and all semester transcripts.',
        'The APS certificate.',
        'The language certificate required by the programme.',
      ],
      'uni-assist does not decide on admission. The university makes the decision.',
    ],
  },

  // ------------------------------------------------------------------ employer
  {
    slug: 'klinikum-koeln-pflegefachkraft',
    site: 'Klinikum Köln-Mitte (demo employer)',
    title: 'Pflegefachkraft (m/w/d) — internationale Bewerbungen willkommen',
    updated: '2026-09-28',
    body: [
      'Klinikum Köln-Mitte is a 600-bed hospital in Cologne. We are recruiting qualified nurses from abroad for our general medicine and surgical wards, starting September 2027.',
      'What we offer',
      [
        'A permanent contract under the TVöD-P collective agreement, pay group P7, about EUR 3,300 gross per month at entry.',
        'We pay the recognition procedure and the adaptation course, and we provide a furnished room for the first six months.',
        'A B2 German course in Cologne alongside work, paid by the hospital.',
      ],
      'What we expect',
      [
        'A completed nursing qualification of at least three years and registration in your home country.',
        'German at B1 at the time of arrival, and B2 within twelve months.',
        'A started or completed recognition file for the state of North Rhine-Westphalia.',
      ],
      'Applications in German or English are both fine. We interview online.',
    ],
  },

  // ------------------------------------------------------------------ Educaro's own services
  {
    slug: 'educaro-nursing-program',
    site: 'Educaro',
    title: 'Nursing Program — work as a nurse in Germany',
    updated: '2026-09-20',
    body: [
      'The Educaro Nursing Program places qualified Indian nurses with German hospitals. The programme is free for the nurse, because the hiring hospital pays our fee.',
      'What is included',
      [
        'German lessons online from India up to B1, then B2 in Germany alongside work.',
        'Interviews with German hospitals and a permanent contract before you travel.',
        'The recognition file, the visa application and help with the move.',
      ],
      'Who can join',
      [
        'The programme requires a B.Sc. Nursing, a Post Basic B.Sc. Nursing or an M.Sc. Nursing.',
        'Candidates holding only a GNM diploma are placed through our Ausbildung programme instead, which leads to the German qualification directly.',
        'At least six months of hospital experience, and a valid nursing council registration.',
      ],
    ],
  },
  {
    slug: 'educaro-ausbildung',
    site: 'Educaro',
    title: 'Ausbildung in Germany — paid vocational training',
    updated: '2026-09-20',
    body: [
      'An Ausbildung is a paid vocational training in Germany. In healthcare it lasts three years and ends with the German professional qualification, which needs no further recognition.',
      'What you get',
      [
        'A training salary of about EUR 1,100 to EUR 1,500 per month during the training.',
        'The German nursing qualification at the end, which is recognised everywhere in Germany and in the EU.',
        'German lessons to B1 before you travel and to B2 during the training.',
      ],
      'Who it suits',
      [
        'Candidates with a GNM diploma, or with Class 12 and no nursing degree.',
        'You must be at least 18 and have German at B1 when the training starts.',
      ],
      'Educaro arranges the training place, the contract, the visa and the accommodation.',
    ],
  },
  {
    slug: 'educaro-study-in-germany',
    site: 'Educaro',
    title: 'University Pathway Program — study in Germany',
    updated: '2026-09-20',
    body: [
      'We take Indian students from shortlisting a programme to the first week on campus.',
      'What is included',
      [
        'Programme search matched to your grades and your subject.',
        'The APS application and the uni-assist submission.',
        'Small-group German lessons, a student residence room and visa preparation.',
      ],
      'Public universities in Germany charge no tuition fees for a Master programme. You pay only the semester contribution, which is between EUR 85 and EUR 350.',
    ],
  },
];

export const PAGE_BY_SLUG = new Map(MOCK_PAGES.map((p) => [p.slug, p]));

/** Renders a page as plain, readable HTML. The agent's fetcher strips it back to text. */
export function renderPage(p: MockPage, base: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const parts = p.body
    .map((b) => (Array.isArray(b) ? `<ul>${b.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>` : `<p>${esc(b)}</p>`))
    .join('\n    ');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(p.title)} — ${esc(p.site)}</title>
  <meta name="description" content="${esc(p.title)}" />
  <style>
    body { font: 16px/1.6 system-ui, sans-serif; max-width: 46rem; margin: 2rem auto; padding: 0 1rem; color: #16202b; }
    header { border-bottom: 2px solid #e2e8f0; padding-bottom: .75rem; margin-bottom: 1.5rem; }
    .site { font-weight: 700; letter-spacing: .02em; text-transform: uppercase; font-size: .78rem; color: #64748b; }
    h1 { font-size: 1.5rem; margin: .3rem 0 0; }
    .meta { font-size: .8rem; color: #64748b; margin-top: .4rem; }
    li { margin: .3rem 0; }
    footer { margin-top: 3rem; border-top: 1px solid #e2e8f0; padding-top: .75rem; font-size: .78rem; color: #94a3b8; }
  </style>
</head>
<body>
  <header>
    <div class="site">${esc(p.site)}</div>
    <h1>${esc(p.title)}</h1>
    <div class="meta">Last updated ${esc(p.updated ?? '2026-09-01')}</div>
  </header>
  <main>
    ${parts}
  </main>
  <footer>
    Stand-in page served by the Educaro prototype at ${esc(base)}/api/mock/${esc(p.slug)} so the
    agent can open a source and quote it without depending on the live internet during a demo.
  </footer>
</body>
</html>`;
}
