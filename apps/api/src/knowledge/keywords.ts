/**
 * What this university or employer is actually asking for, read off their own page.
 *
 * A CV tailored to a target is the single highest-value thing this product can do with a document
 * it already holds — and it is also the easiest place to start lying. The temptation is to let a
 * model rewrite the CV "for the role", which produces a CV describing somebody who does not exist
 * and an applicant who cannot answer a question about their own skills in an interview.
 *
 * So the division here is strict and it is the whole design:
 *
 * - **The target's requirements come from the target's page.** Extracted in code, from the text we
 *   actually opened, not from a model's memory of what a data science course wants.
 * - **The applicant's skills come from the applicant's documents.** Verified or You-said, never
 *   inferred.
 * - **Tailoring is selection and ordering, never addition.** We decide which true things to put
 *   first. A keyword the applicant has no evidence for is reported as a gap to them, not written
 *   into the CV.
 *
 * The result is a CV that is both targeted and defensible line by line, which is the only kind
 * worth sending.
 */

export interface KeywordHit {
  /** The canonical form, as it should appear on a CV. */
  term: string;
  /** How the page wrote it, so a human can check we read it correctly. */
  asWritten: string;
  /** Roughly where it sat: a hard requirement reads differently from a nice-to-have. */
  weight: 'required' | 'desirable';
}

/**
 * The vocabulary.
 *
 * Deliberately a fixed list rather than "any capitalised noun": an open extractor pulls out
 * "Germany", "Faculty" and "Application" and then the match report is noise. Grouped by the routes
 * this product actually serves.
 */
/**
 * The vocabulary.
 *
 * Deliberately a fixed list rather than "any capitalised noun": an open extractor pulls out
 * "Germany", "Faculty" and "Application", and then the match report is noise.
 *
 * Each term carries two patterns, because a page and a CV describe the same skill differently and
 * conflating them was the first version's mistake. `match` is how the *requirement* is written:
 * RWTH asks for "programming experience". `evidence` is how the *proof* is written: an employment
 * certificate says "backend services in Python and Java". Matching only on the page's phrasing made
 * a B.Tech computer scientist with two years of Python at Persistent Systems score zero against a
 * data science course, which is both wrong and exactly the kind of wrong that makes a tailored CV
 * worthless.
 *
 * Indirect evidence is still evidence — "worked as a software engineer" does establish programming
 * experience — but it has to be real. Nothing here infers a skill from a job title it does not
 * imply, and anything unmatched is reported as a gap rather than quietly written onto the CV.
 */
const VOCAB: { term: string; match: RegExp; evidence?: RegExp }[] = [
  // --- computing and data ---
  { term: 'Python', match: /\bpython\b/i },
  { term: 'Java', match: /\bjava\b(?!script)/i },
  { term: 'JavaScript', match: /\bjava ?script\b/i },
  { term: 'TypeScript', match: /\btype ?script\b/i },
  { term: 'C++', match: /\bc\+\+\b/i },
  { term: 'SQL', match: /\bsql\b/i, evidence: /\bsql\b|\bpostgres\w*|\bmysql\b|\boracle\b/i },
  { term: 'Machine learning', match: /\bmachine learning\b|\bml\b/i },
  { term: 'Deep learning', match: /\bdeep learning\b|\bneural network/i },
  { term: 'Statistics', match: /\bstatistic\w*\b|\bstochastic\b/i, evidence: /\bstatistic\w*\b|\bstochastic\b|\bdata analy\w+/i },
  { term: 'Linear algebra', match: /\blinear algebra\b/i },
  { term: 'Probability theory', match: /\bprobability\b/i },
  { term: 'Data mining', match: /\bdata mining\b/i },
  { term: 'Data visualisation', match: /\bvisuali[sz]ation\b/i },
  {
    term: 'Distributed systems',
    match: /\bdistributed systems?\b/i,
    evidence: /\bdistributed\b|\bkafka\b|\bstreaming\b|\bmicroservice\w*|\bmessage quee?u\w*/i,
  },
  { term: 'Databases', match: /\bdatabases?\b/i, evidence: /\bdatabases?\b|\bpostgres\w*|\bmysql\b|\bsql\b|\bmongo\w*/i },
  { term: 'Algorithms', match: /\balgorithms?\b/i },
  {
    term: 'Software engineering',
    match: /\bsoftware engineering\b/i,
    evidence: /\bsoftware engineer\w*|\bdeveloper\b|\bbackend\b|\bfull.?stack\b/i,
  },
  { term: 'Cloud computing', match: /\bcloud\b|\baws\b|\bazure\b/i },
  { term: 'Docker', match: /\bdocker\b|\bkubernetes\b/i },
  { term: 'Git', match: /\bgit\b|\bversion control\b/i },
  { term: 'Research experience', match: /\bresearch (experience|project|thesis)\b/i, evidence: /\bresearch\b|\bthesis\b|\bpublication\b|\bdissertation\b/i },
  {
    term: 'Programming experience',
    match: /\bprogramming (experience|skills?)\b/i,
    // An employment certificate never says "programming experience"; it names the languages.
    evidence: /\bprogramming\b|\bpython\b|\bjava\b|\bc\+\+\b|\bsoftware engineer\w*|\bdeveloper\b|\bbackend\b|\bcoding\b/i,
  },

  // --- nursing and care ---
  { term: 'Intensive care', match: /\bintensive care\b|\bicu\b|\bintensiv\w*/i },
  { term: 'General medicine ward', match: /\bgeneral medicine\b|\binnere medizin\b/i },
  { term: 'Surgical ward', match: /\bsurgical\b|\bchirurgie\b/i, evidence: /\bsurgical\b|\bsurgery\b|\bchirurgie\b|\bpost-?operative\b/i },
  { term: 'Geriatric care', match: /\bgeriatric\b|\belderly care\b|\baltenpflege\b/i },
  { term: 'Paediatrics', match: /\bpaediatric\b|\bpediatric\b|\bkinderkrankenpflege\b/i },
  { term: 'Emergency care', match: /\bemergency\b|\bnotaufnahme\b/i, evidence: /\bemergency\b|\bcasualty\b|\btriage\b|\bnotaufnahme\b/i },
  { term: 'Wound care', match: /\bwound care\b|\bwundversorgung\b/i, evidence: /\bwound\b|\bdressing\b|\bwundversorgung\b/i },
  { term: 'Medication administration', match: /\bmedication\b|\bmedikament\w*/i, evidence: /\bmedication\b|\bmedicine administration\b|\bmedikament\w*|\bdrug administration\b/i },
  { term: 'Patient documentation', match: /\bdocumentation\b|\bdokumentation\b/i, evidence: /\bdocumentation\b|\bcharting\b|\brecords?\b|\bdokumentation\b/i },
  { term: 'Post-operative monitoring', match: /\bpost-?operative\b|\bpostoperativ\w*/i, evidence: /\bpost-?operative\b|\bpostoperativ\w*|\bmonitoring\b/i },
  { term: 'Shift work', match: /\bshift work\b|\bschichtdienst\b|\bwechselschicht\w*/i, evidence: /\bshift\b|\bnight duty\b|\brotating\b|\bschichtdienst\b/i },
  { term: 'Midwifery', match: /\bmidwif\w+\b|\bhebamme\b/i, evidence: /\bmidwif\w+\b|\bgnm\b|\bgeneral nursing and midwifery\b|\bhebamme\b/i },

  // --- language ---
  // CEFR levels are a ladder: evidence of C1 satisfies a B1 requirement, and a test band maps onto
  // the ladder too. Matching the literal string meant IELTS 7.0 failed an "English C1" requirement.
  { term: 'German B1', match: /\bgerman\b[^.]{0,40}\bb1\b|\bb1\b[^.]{0,30}\bgerman\b/i, evidence: /\bgerman\b[^.]{0,40}\b(b1|b2|c1|c2)\b|\b(b1|b2|c1|c2)\b[^.]{0,30}\bgerman\b|\bgoethe\b[^.]{0,20}\b(b1|b2|c1|c2)\b/i },
  { term: 'German B2', match: /\bgerman\b[^.]{0,40}\bb2\b|\bb2\b[^.]{0,30}\bgerman\b/i, evidence: /\bgerman\b[^.]{0,40}\b(b2|c1|c2)\b|\b(b2|c1|c2)\b[^.]{0,30}\bgerman\b|\bgoethe\b[^.]{0,20}\b(b2|c1|c2)\b/i },
  { term: 'German C1', match: /\bgerman\b[^.]{0,40}\bc1\b|\bc1\b[^.]{0,30}\bgerman\b/i, evidence: /\bgerman\b[^.]{0,40}\b(c1|c2)\b|\b(c1|c2)\b[^.]{0,30}\bgerman\b/i },
  {
    term: 'English C1',
    match: /\benglish\b[^.]{0,40}\bc1\b/i,
    // IELTS 7.0 and TOEFL 95 are C1 on the Council of Europe alignment, and that is how an Indian
    // applicant's English is actually documented — never as the letters "C1".
    evidence: /\benglish\b[^.]{0,40}\b(c1|c2)\b|\bielts\b\D{0,10}(7(\.\d)?|8(\.\d)?|9(\.\d)?)\b|\btoefl\b\D{0,10}(9[5-9]|1[0-9]{2})\b/i,
  },

  // --- general ---
  { term: 'Teamwork', match: /\bteam ?work\b|\bteamf(ä|ae)hig\w*/i, evidence: /\bteam\b|\bcollaborat\w+/i },
  { term: 'Communication skills', match: /\bcommunication skills?\b|\bkommunikationsf\w*/i, evidence: /\bcommunication\b|\bstakeholder\w*|\bpresent\w+/i },
  { term: 'Project management', match: /\bproject management\b|\bprojektmanagement\b/i, evidence: /\bproject (management|lead|owner)\b|\bprojektmanagement\b|\bscrum\b|\bagile\b/i },
  { term: 'Internship', match: /\binternship\b|\bpraktikum\b/i, evidence: /\bintern\b|\binternship\b|\bpraktikum\b|\btrainee\b/i },
];

/** Sentences that mark something as non-negotiable rather than a wish. */
const REQUIRED_CONTEXT = /\b(must|required|requirement|mandatory|expected to|is necessary|voraussetzung|erforderlich|vorausgesetzt)\b/i;

/**
 * Pull the keywords a target page asks for.
 *
 * Weight is decided by the sentence the term appeared in, because "programming experience must be
 * documented" and "some programming is an advantage" are different claims and a CV should lead with
 * the first.
 */
export function keywordsFromPage(text: string): KeywordHit[] {
  const t = (text ?? '').replace(/\s+/g, ' ');
  if (!t) return [];
  const sentences = t.split(/(?<=[.!?])\s+/);
  const found = new Map<string, KeywordHit>();

  for (const sentence of sentences) {
    const required = REQUIRED_CONTEXT.test(sentence);
    for (const v of VOCAB) {
      const m = sentence.match(v.match);
      if (!m) continue;
      const existing = found.get(v.term);
      // A term seen once as required stays required, however many times it is mentioned casually.
      if (existing) {
        if (required) existing.weight = 'required';
        continue;
      }
      found.set(v.term, { term: v.term, asWritten: m[0], weight: required ? 'required' : 'desirable' });
    }
  }

  return [...found.values()].sort((a, b) => (a.weight === b.weight ? 0 : a.weight === 'required' ? -1 : 1));
}

export interface KeywordMatch {
  term: string;
  weight: 'required' | 'desirable';
  /** Did we find evidence for it on this applicant's own file? */
  have: boolean;
  /** The fact or document that backs it, so every claim on the CV is traceable. */
  evidence: string | null;
  /** 'verified' when a document proved it, 'said' when they told us. */
  tag: 'verified' | 'said' | null;
  /** The fact row behind it, so a sentence in a letter can cite a source rather than a filename. */
  factId?: string;
}

export interface TailorReport {
  target: string;
  /** Every keyword the page asks for, matched against what the applicant can actually show. */
  matches: KeywordMatch[];
  matched: number;
  required: number;
  requiredMatched: number;
  /** What the page wants and they cannot evidence. Reported, never written into the CV. */
  missing: KeywordMatch[];
}

/**
 * Match a target's keywords against what the applicant can actually show.
 *
 * `haystack` is their own evidence: the text of their documents plus their stated facts. A term
 * only counts as held if it appears there — the whole point is that the CV can be defended sentence
 * by sentence in an interview conducted in a language they are still learning.
 */
export function matchKeywords(
  target: string,
  wanted: KeywordHit[],
  evidence: { text: string; label: string; tag: 'verified' | 'said'; factId?: string }[],
): TailorReport {
  const matches: KeywordMatch[] = wanted.map((w) => {
    const v = VOCAB.find((x) => x.term === w.term);
    // Prefer a verified source over a stated one: the strongest evidence is what a reader will ask about.
    // The evidence pattern where there is one, because a CV and a prospectus describe the same
    // skill in different words. Verified sources are checked before stated ones: the strongest
    // evidence is the one a reader will ask about.
    const re = v?.evidence ?? v?.match;
    const hit = re
      ? [...evidence].sort((a, b) => (a.tag === b.tag ? 0 : a.tag === 'verified' ? -1 : 1)).find((e) => re.test(e.text))
      : undefined;
    return { term: w.term, weight: w.weight, have: Boolean(hit), evidence: hit?.label ?? null, tag: hit?.tag ?? null, factId: hit?.factId };
  });

  const required = matches.filter((m) => m.weight === 'required');
  return {
    target,
    matches,
    matched: matches.filter((m) => m.have).length,
    required: required.length,
    requiredMatched: required.filter((m) => m.have).length,
    missing: matches.filter((m) => !m.have),
  };
}
