/**
 * Demo pages that change.
 *
 * The watcher is only believable if a jury can see a page move. Pointing it at a real university
 * site means waiting months for an edit that may never come, so these three stand-ins carry two
 * versions each and a switch: version 1 is what the page said when the applicant was first assessed
 * against it, version 2 is after the institution revised it.
 *
 * They are deliberately plain HTML in the shape real pages take — a heading, prose, a list of
 * requirements — because the parser has to work on prose it did not author. The numbers in version 1
 * match the real pages as checked in `research/knowledge.md`; the version 2 edits are invented, and
 * each page says so in a footer so nobody mistakes the demo for a live announcement.
 *
 * Two of the three ease their requirements and one tightens, because a watcher that only ever
 * brings good news has not been tested against the case that matters more.
 */

export interface WatchedPage {
  slug: string;
  kind: 'university' | 'government' | 'employer';
  site: string;
  title: string;
  /** Who this page governs, for matching applicants when no shortlist links them. */
  route?: string;
  versions: { updated: string; note: string; body: (string | string[])[] }[];
}

export const WATCHED_PAGES: WatchedPage[] = [
  {
    slug: 'rwth-msc-data-science-admission',
    kind: 'university',
    site: 'RWTH Aachen University',
    title: 'M.Sc. Data Science — Admission requirements',
    route: 'study',
    versions: [
      {
        updated: '2026-09-02',
        note: 'As assessed when the applicant was first matched.',
        body: [
          'The Master of Science in Data Science is a four-semester programme taught entirely in English. Admission is competitive and is decided by the examination board on the documents submitted.',
          'Entry qualification',
          [
            'Applicants must hold a Bachelor degree in computer science, mathematics, statistics or a closely related subject with at least 180 ECTS credits.',
            'A final grade of at least 2.5 on the German grading scale is required.',
            'At least 18 ECTS credits in mathematics, including linear algebra and probability theory, must be documented in the transcript.',
          ],
          'Language requirements',
          [
            'Proof of English at level C1 is required. IELTS Academic with an overall band of 6.5, or TOEFL iBT 90, are accepted.',
            'No proof of German is required for admission.',
          ],
          'Application route and deadlines',
          [
            'Applicants with a degree from India must apply through uni-assist and must enclose the APS certificate.',
            'The application deadline for the winter semester is 1 March for applicants who need a visa.',
            'There are no tuition fees. The semester contribution is EUR 330 per semester and includes a public transport ticket.',
          ],
          'GRE is not required for this programme.',
        ],
      },
      {
        updated: '2026-10-09',
        note: 'Revised by the examination board for the 2027 intake.',
        body: [
          'The Master of Science in Data Science is a four-semester programme taught entirely in English. Following a review of the 2026 intake, the examination board has revised the entry requirements to widen the applicant pool.',
          'Entry qualification',
          [
            'Applicants must hold a Bachelor degree in computer science, mathematics, statistics or a closely related subject with at least 180 ECTS credits.',
            'A final grade of at least 2.8 on the German grading scale is required.',
            'At least 18 ECTS credits in mathematics, including linear algebra and probability theory, must be documented in the transcript.',
          ],
          'Language requirements',
          [
            'Proof of English at level B2 is required. IELTS Academic with an overall band of 6.0, or TOEFL iBT 80, are accepted.',
            'No proof of German is required for admission.',
          ],
          'Application route and deadlines',
          [
            'Applicants with a degree from India must apply through uni-assist and must enclose the APS certificate.',
            'The application deadline for the winter semester is 15 March for applicants who need a visa.',
            'There are no tuition fees. The semester contribution is EUR 345 per semester and includes a public transport ticket.',
          ],
          'GRE is not required for this programme.',
        ],
      },
    ],
  },
  {
    slug: 'bmi-skilled-worker-requirements',
    kind: 'government',
    site: 'Bundesministerium des Innern (demo stand-in)',
    title: 'Skilled Immigration Act — language and qualification thresholds',
    route: 'nursing',
    versions: [
      {
        updated: '2026-07-15',
        note: 'Thresholds in force for the 2026 cohort.',
        body: [
          'This page sets out the thresholds applied when a skilled worker from a third country applies for a residence permit for employment.',
          'Health and care professions',
          [
            'Proof of German at level B2 is required before the licence to practise (Berufserlaubnis) is granted.',
            'Recognition of your qualification (Anerkennung) must be applied for before entry.',
            'At least 2 years of experience in the profession is expected where the qualification is a diploma rather than a degree.',
          ],
          'Fees and processing',
          [
            'The visa fee is EUR 75.',
            'The application deadline for the spring intake is 1 February.',
          ],
        ],
      },
      {
        updated: '2026-10-09',
        note: 'Amended following the care-sector shortage review.',
        body: [
          'This page sets out the thresholds applied when a skilled worker from a third country applies for a residence permit for employment. Following the care-sector shortage review, the language threshold for health and care professions has been lowered.',
          'Health and care professions',
          [
            'Proof of German at level B1 is required before the licence to practise (Berufserlaubnis) is granted, provided the employer commits to further training.',
            'Recognition of your qualification (Anerkennung) must be applied for before entry.',
            'At least 2 years of experience in the profession is expected where the qualification is a diploma rather than a degree.',
          ],
          'Fees and processing',
          [
            'The visa fee is EUR 75.',
            'The application deadline for the spring intake is 1 February.',
          ],
        ],
      },
    ],
  },
  {
    slug: 'klinikum-koeln-nurse-vacancy',
    kind: 'employer',
    site: 'Klinikum Köln-Mitte',
    title: 'Pflegefachkraft (m/w/d) — internationale Bewerbungen',
    route: 'nursing',
    versions: [
      {
        updated: '2026-08-30',
        note: 'As advertised when the applicant was matched.',
        body: [
          'We are recruiting registered nurses for our general and intensive care wards. International applicants are welcome and we support the recognition procedure.',
          'What we ask for',
          [
            'Proof of German at level B1 at the time of application. We fund the course to B2 after arrival.',
            'Recognition of your qualification must be in progress; it does not need to be complete.',
            'At least 2 years of experience on a ward.',
          ],
          'What we offer',
          [
            'Pay according to TVöD-P, group P7, from EUR 3,304 per month gross, plus shift supplements.',
            '30 days of holiday, a subsidised Deutschlandticket and a room in staff accommodation for the first six months.',
          ],
        ],
      },
      {
        updated: '2026-10-09',
        note: 'Updated after the ward restructure.',
        body: [
          'We are recruiting registered nurses for our general and intensive care wards. Following the restructure of our intensive care unit, we have revised the requirements for international applicants.',
          'What we ask for',
          [
            'Proof of German at level B2 at the time of application.',
            'Recognition of your qualification must be in progress; it does not need to be complete.',
            'At least 3 years of experience on a ward.',
          ],
          'What we offer',
          [
            'Pay according to TVöD-P, group P7, from EUR 3,450 per month gross, plus shift supplements.',
            '30 days of holiday, a subsidised Deutschlandticket and a room in staff accommodation for the first six months.',
          ],
        ],
      },
    ],
  },
];

export const WATCHED_BY_SLUG = new Map(WATCHED_PAGES.map((p) => [p.slug, p]));

/**
 * Which version each page is currently serving.
 *
 * In memory rather than in the database on purpose: this is a property of the demo, not of the
 * product, and a restart should put every page back to where the script expects it.
 */
const served = new Map<string, number>();

export const versionOf = (slug: string): number => served.get(slug) ?? 0;

export function setVersion(slug: string, version: number): number {
  const page = WATCHED_BY_SLUG.get(slug);
  if (!page) return 0;
  const v = Math.max(0, Math.min(page.versions.length - 1, version));
  served.set(slug, v);
  return v;
}

/** Move a page to its next version, wrapping back to the first. */
export function advance(slug: string): number {
  const page = WATCHED_BY_SLUG.get(slug);
  if (!page) return 0;
  return setVersion(slug, (versionOf(slug) + 1) % page.versions.length);
}

export function resetVersions(): void {
  served.clear();
}

/** Plain HTML, in the shape a real institution's page takes. */
export function renderWatched(page: WatchedPage, apiUrl: string): string {
  const v = page.versions[versionOf(page.slug)];
  const body = v.body
    .map((b) =>
      Array.isArray(b)
        ? `<ul>${b.map((li) => `<li>${li}</li>`).join('')}</ul>`
        : b.length < 70 && !b.endsWith('.')
          ? `<h2>${b}</h2>`
          : `<p>${b}</p>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${page.title} — ${page.site}</title>
<style>
  body{font:16px/1.65 Georgia,'Times New Roman',serif;max-width:48rem;margin:0 auto;padding:2rem 1.25rem;color:#1a1a1a}
  header{border-bottom:3px solid #00549f;padding-bottom:.75rem;margin-bottom:1.5rem}
  .site{color:#00549f;font-weight:700;letter-spacing:.02em;text-transform:uppercase;font-size:.8rem}
  h1{font-size:1.6rem;margin:.3rem 0 0}
  h2{font-size:1.1rem;margin:1.6rem 0 .4rem;color:#00549f}
  ul{padding-left:1.2rem}
  li{margin:.3rem 0}
  .meta{color:#555;font-size:.85rem;margin-top:.4rem}
  footer{margin-top:2.5rem;border-top:1px solid #ccc;padding-top:.75rem;color:#666;font-size:.78rem}
</style>
</head>
<body>
<header>
  <div class="site">${page.site}</div>
  <h1>${page.title}</h1>
  <div class="meta">Last updated: ${v.updated}</div>
</header>
${body}
<footer>
  This is a stand-in page served by Educaro for demonstration, not a publication of ${page.site}.
  Version ${versionOf(page.slug) + 1} of ${page.versions.length}: ${v.note}
  <br>Source list: <a href="${apiUrl}/api/mock/watched">all watched demo pages</a>
</footer>
</body>
</html>`;
}

/** The visible text, which is what the parser reads — never the markup. */
export function watchedText(page: WatchedPage): string {
  const v = page.versions[versionOf(page.slug)];
  return [page.title, ...v.body.flatMap((b) => (Array.isArray(b) ? b : [b]))].join('\n');
}
