import type { DocKind } from '@educaro/shared';

/**
 * Sort on arrival, in code. Each kind has weighted patterns over the text and the file name.
 * Only when the best score is weak does the extractor ask a model to classify as well.
 */
const RULES: { kind: DocKind; text: [RegExp, number][]; name?: RegExp }[] = [
  { kind: 'passport', text: [[/P<IND/, 6], [/republic of india/i, 2], [/\bpassport\b/i, 3], [/date of expiry|place of issue/i, 2]], name: /passport/i },
  {
    kind: 'language_certificate',
    text: [[/goethe[- ]zertifikat|goethe-institut/i, 5], [/\bösd\b|österreichisches sprachdiplom|osd zertifikat/i, 5], [/\btelc\b/i, 4], [/\bielts\b/i, 3], [/test report form/i, 4], [/\btoefl\b|testdaf/i, 4], [/overall band score/i, 4]],
    name: /ielts|goethe|osd|ösd|telc|toefl|german|language/i,
  },
  { kind: 'aps_certificate', text: [[/akademische prüfstelle/i, 6], [/academic evaluation cent(re|er)/i, 6], [/\bAPS\b.*certificate/i, 4]], name: /\baps\b/i },
  { kind: 'registration_certificate', text: [[/nursing council/i, 4], [/registered (nurse|midwife)/i, 3], [/registration (no|number)/i, 2]], name: /registration|council|rn\b/i },
  {
    kind: 'experience_letter',
    text: [[/to whom it may concern/i, 3], [/experience (certificate|letter)/i, 4], [/has been (working|employed)|was (working|employed)|worked with us/i, 4], [/relieving|service certificate/i, 3]],
    name: /experience|relieving|employment/i,
  },
  { kind: 'payslip', text: [[/pay ?slip|salary slip/i, 6], [/net (pay|salary)/i, 3], [/gross (pay|salary|earnings)/i, 2], [/deductions/i, 1]], name: /payslip|salary/i },
  {
    kind: 'marksheet_12',
    text: [[/higher secondary/i, 4], [/senior (school|secondary)( certificate)?/i, 4], [/class\s*(xii|12)/i, 4], [/all india senior/i, 4]],
    name: /12th|xii|class.?12|hsc|plus.?two/i,
  },
  {
    kind: 'marksheet_10',
    text: [[/secondary school (leaving )?(certificate|examination)/i, 4], [/class\s*(x|10)\b/i, 4], [/matriculation/i, 4], [/all india secondary/i, 4]],
    name: /10th|\bx\b|class.?10|sslc|ssc/i,
  },
  { kind: 'transcript', text: [[/grade card|transcript|statement of (marks|grades)/i, 4], [/semester/i, 2], [/\bsgpa\b|\bcgpa\b/i, 2]], name: /transcript|semester|grade.?card|marks/i },
  {
    kind: 'diploma_certificate',
    text: [[/general nursing (and|&) midwifery/i, 6], [/diploma in/i, 3], [/\bGNM\b/, 3], [/this is to certify/i, 1]],
    name: /diploma|gnm/i,
  },
  {
    kind: 'degree_certificate',
    text: [[/bachelor of|master of/i, 4], [/degree of/i, 3], [/conferred|awarded the degree/i, 3], [/\bB\.?\s?Tech\b|\bB\.?\s?Sc\b|\bB\.?\s?E\b/i, 2], [/this is to certify/i, 1]],
    name: /degree|convocation|bachelor|master/i,
  },
  {
    kind: 'cv',
    text: [[/curriculum vitae|\bresume\b|\brésumé\b/i, 5], [/work experience|professional experience|employment history/i, 2], [/\beducation\b/i, 1], [/\bskills\b/i, 1], [/(professional )?summary|objective/i, 1]],
    name: /cv|resume|lebenslauf/i,
  },
];

export function classifyByRules(text: string, fileName: string): { kind: DocKind; confidence: number } {
  const head = text.slice(0, 4000);
  let best: { kind: DocKind; score: number } = { kind: 'other', score: 0 };
  let second = 0;
  for (const r of RULES) {
    let score = 0;
    for (const [re, w] of r.text) if (re.test(head)) score += w;
    if (r.name?.test(fileName)) score += 3;
    // A CV mentions degrees and employers; a certificate is short.
    if (r.kind === 'cv' && head.length > 1500) score += 1;
    if (score > best.score) {
      second = best.score;
      best = { kind: r.kind, score };
    } else if (score > second) second = score;
  }
  if (best.score === 0) return { kind: 'other', confidence: 0 };
  const margin = best.score - second;
  const confidence = Math.min(0.98, 0.35 + best.score * 0.06 + margin * 0.05);
  return { kind: best.kind, confidence: Number(confidence.toFixed(2)) };
}
