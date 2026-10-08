import { z } from 'zod';
import type { DocKind } from '@educaro/shared';
import { DocKind as DocKindSchema } from '@educaro/shared';
import { parseCefr } from '../knowledge/cefr';
import { parseMonth } from '../knowledge/normalize';

const S = () => z.string().nullable();

// ---------------- documents ----------------
export const DocExtraction = z.object({
  kind: z.enum(DocKindSchema.options as [DocKind, ...DocKind[]]),
  confidence: z.number(),
  unclear: z.boolean(),
  unclearReason: S(),
  holderName: S(),
  issuer: S(),
  dateIssued: S(),
  qualification: S(),
  field: S(),
  institution: S(),
  year: S(),
  grade: S(),
  gradeScaleMax: z.number().nullable(),
  gradePassMin: z.number().nullable(),
  employer: S(),
  role: S(),
  startDate: S(),
  endDate: S(),
  language: z.enum(['german', 'english']).nullable(),
  level: S(),
  testName: S(),
  score: S(),
  passportNumber: S(),
  dateOfBirth: S(),
  nationality: S(),
  expiry: S(),
  registrationNumber: S(),
  council: S(),
  monthlySalary: S(),
});
export type DocExtraction = z.infer<typeof DocExtraction>;

export const DOC_SYSTEM = `You read documents uploaded by Indian applicants to a German migration agency.
Extract only what is printed on the page. Never guess or fill gaps. Use null for anything not present.
Dates: YYYY-MM-DD or YYYY-MM. holderName exactly as printed (keep initials, keep capitals).
grade: as printed, e.g. "CGPA 8.2/10" or "78%". level: CEFR level like "A2" when printed or implied by the exam name.
Set unclear=true when the text is garbled, cut off or too short to trust, and say why in unclearReason.
confidence: 0..1, how sure you are about kind and fields.`;

export function docUserPrompt(text: string, fileName: string, guess: DocKind): string {
  return `File name: ${fileName}\nRule-based guess: ${guess}\n\nText:\n${text.slice(0, 3500)}`;
}

/** Zero-cost fallback. Works well on clean text PDFs, which is what the seeded demo files are. */
export function extractDocByRules(kind: DocKind, text: string): DocExtraction {
  const t = text.replace(/\r/g, '');
  const grab = (re: RegExp) => t.match(re)?.[1]?.trim() ?? null;
  const name =
    grab(/(?:name of (?:the )?(?:candidate|student|holder|employee)|given name\(s\)|name)\s*[:\-]\s*([A-Za-z .]+?)\s*(?:\n|$)/i) ??
    grab(/certify that\s+(?:mr\.?|ms\.?|mrs\.?)?\s*([A-Z][A-Za-z .]+?)\s+(?:has|was|is|d\/o|s\/o)/);
  const surname = grab(/surname\s*[:\-]\s*([A-Za-z ]+)/i);
  const given = grab(/given name\(?s?\)?\s*[:\-]\s*([A-Za-z ]+)/i);
  const holderName = kind === 'passport' && given ? `${given} ${surname ?? ''}`.trim() : name;
  const period = t.match(/from\s+([A-Za-z]{3,9}\.?\s+\d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{2}[./]\d{4})\s+(?:to|till|until|-)\s+([A-Za-z]{3,9}\.?\s+\d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{2}[./]\d{4}|present|date)/i);
  const iso = (s: string | null) => {
    const p = parseMonth(s);
    return p ? `${p.y}-${String(p.m ?? 1).padStart(2, '0')}` : null;
  };
  const lvl = parseCefr(grab(/\b(?:level|niveau|stufe)\s*[:\-]?\s*([ABC][12])\b/i) ?? grab(/zertifikat\s+([ABC][12])\b/i) ?? grab(/\b([ABC][12])\b/));
  const band = grab(/overall band score\s*[:\-]?\s*(\d(?:\.\d)?)/i);
  const isGerman = /goethe|ösd|osd|telc|deutsch|german/i.test(t);
  return {
    kind,
    confidence: 0.6,
    unclear: t.replace(/\s/g, '').length < 60,
    unclearReason: t.replace(/\s/g, '').length < 60 ? 'Very little readable text' : null,
    holderName,
    issuer: grab(/(?:issued by|issuing authority|board|university|council)\s*[:\-]\s*(.+)/i),
    dateIssued: grab(/(?:date of issue|issued on|date)\s*[:\-]\s*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{4}|[A-Za-z]+ \d{1,2},? \d{4})/i),
    qualification:
      grab(/(diploma in [A-Za-z &]+)/i) ??
      grab(/((?:bachelor|master) of [A-Za-z ]+?)(?:\s+in\s+|\n|,|$)/i) ??
      grab(/(general nursing (?:and|&) midwifery)/i),
    field: grab(/(?:branch|discipline|specialisation|specialization|in the field of)\s*[:\-]?\s*([A-Za-z &]+)/i),
    institution: grab(/(?:institution|college|university|school)\s*[:\-]\s*(.+)/i),
    year: grab(/(?:year of (?:passing|completion)|examination held in|passed in)\s*[:\-]?\s*([A-Za-z]*\s*\d{4})/i),
    grade: grab(/((?:CGPA|CPI|GPA)\s*[:\-]?\s*\d{1,2}\.\d{1,2}(?:\s*\/\s*10)?)/i) ?? grab(/(\d{2}(?:\.\d+)?\s*%)/),
    gradeScaleMax: null,
    gradePassMin: null,
    employer: grab(/(?:employer|organisation|organization|hospital)\s*[:\-]\s*(.+)/i) ?? grab(/worked (?:with|at)\s+([A-Z][A-Za-z ,]+?)\s+(?:as|from)/),
    role: grab(/(?:designation|position|role)\s*[:\-]\s*(.+)/i) ?? grab(/\bas (?:a |an )?([A-Z][A-Za-z ]+?)\s+from/),
    startDate: iso(period?.[1] ?? null),
    endDate: period?.[2] && /present|date/i.test(period[2]) ? 'present' : iso(period?.[2] ?? null),
    language: kind === 'language_certificate' ? (isGerman ? 'german' : 'english') : null,
    level: lvl,
    testName: grab(/\b(IELTS|TOEFL|TestDaF|Goethe-Zertifikat [ABC][12]|ÖSD Zertifikat [ABC][12]|telc Deutsch [ABC][12])\b/i),
    score: band,
    passportNumber: grab(/passport no\.?\s*[:\-]?\s*([A-Z]\d{7})/i),
    dateOfBirth: grab(/date of birth\s*[:\-]\s*([0-9./-]+)/i),
    nationality: grab(/nationality\s*[:\-]\s*([A-Za-z]+)/i),
    expiry: grab(/date of expiry\s*[:\-]\s*([0-9./-]+)/i),
    registrationNumber: grab(/registration (?:no|number)\.?\s*[:\-]\s*([A-Z0-9/-]+)/i),
    council: grab(/((?:[A-Z][a-z]+ )+Nursing (?:and Midwifery )?Council)/),
    monthlySalary: grab(/net (?:pay|salary)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+)/i),
  };
}

// ---------------- CV ----------------
export const CvExtraction = z.object({
  name: S(),
  email: S(),
  phone: S(),
  city: S(),
  summary: S(),
  education: z.array(z.object({ qualification: z.string(), field: S(), institution: S(), year: S(), grade: S() })),
  experience: z.array(z.object({ employer: z.string(), role: S(), start: S(), end: S(), city: S() })),
  languages: z.array(z.object({ language: z.string(), level: S(), test: S(), score: S() })),
  skills: z.array(z.string()),
});
export type CvExtraction = z.infer<typeof CvExtraction>;

export const CV_SYSTEM = `You read a CV for a German migration agency. Extract exactly what the CV claims, nothing more.
Dates as YYYY-MM when a month is given, else YYYY. Use "present" for ongoing jobs.
Order education from highest to lowest. For languages give the CEFR level if written (A1..C2), and test name + score if any.`;

export function extractCvByRules(text: string): CvExtraction {
  const t = text.replace(/\r/g, '');
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  const email = t.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? null;
  const phone = t.match(/(\+?91[\s-]?)?[6-9]\d{4}\s?\d{5}/)?.[0] ?? null;
  const name = lines.find((l) => /^[A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z.]+){1,3}$/.test(l) && !/curriculum|resume/i.test(l)) ?? null;
  const experience: CvExtraction['experience'] = [];
  const expRe = /^(.+?)\s*[,|–-]\s*(.+?)\s*[,|(]\s*((?:[A-Za-z]{3,9}\s+)?\d{4})\s*(?:–|-|to)\s*((?:[A-Za-z]{3,9}\s+)?\d{4}|present)\)?/i;
  for (const l of lines) {
    const m = l.match(expRe);
    if (m && !/school|college|university|board|institute/i.test(m[1])) {
      experience.push({ role: m[1].trim(), employer: m[2].trim(), start: m[3], end: m[4], city: null });
    }
  }
  const education: CvExtraction['education'] = [];
  for (const l of lines) {
    const m = l.match(/((?:B\.?\s?Tech|B\.?\s?E|B\.?\s?Sc|M\.?\s?Sc|GNM|Diploma|Bachelor|Master)[^,|]*)[,|]\s*([^,|]+)[,|]?\s*(\d{4})?/i);
    if (m) education.push({ qualification: m[1].trim(), field: null, institution: m[2].trim(), year: m[3] ?? null, grade: l.match(/(CGPA\s*\d\.\d+|\d{2}%)/i)?.[1] ?? null });
  }
  const languages: CvExtraction['languages'] = [];
  const g = t.match(/german[^\n]*?\b([ABC][12])\b/i);
  if (g) languages.push({ language: 'German', level: g[1].toUpperCase(), test: null, score: null });
  const ielts = t.match(/IELTS[^\n]*?(\d(?:\.\d)?)/i);
  if (ielts) languages.push({ language: 'English', level: null, test: 'IELTS', score: ielts[1] });
  const skillsLine = lines.findIndex((l) => /^skills/i.test(l));
  const skills = skillsLine >= 0 ? lines.slice(skillsLine + 1, skillsLine + 4).join(', ').split(/[,;•]/).map((s) => s.trim()).filter((s) => s.length > 1).slice(0, 12) : [];
  return { name, email, phone, city: null, summary: null, education, experience, languages, skills };
}

// ---------------- video transcript ----------------
export const TranscriptClaims = z.object({
  name: S(),
  currentRole: S(),
  education: z.object({ value: z.string(), quote: z.string() }).nullable(),
  experience: z.array(z.object({ employer: S(), durationText: z.string(), years: z.number().nullable(), quote: z.string() })),
  germanLevel: z.object({ level: z.string(), quote: z.string() }).nullable(),
  english: z.object({ value: z.string(), quote: z.string() }).nullable(),
  whyGermany: z.object({ value: z.string(), quote: z.string() }).nullable(),
  familyInGermany: z.object({ relation: z.string(), city: z.string(), quote: z.string() }).nullable(),
  preferredCity: z.object({ city: z.string(), quote: z.string() }).nullable(),
  twoYears: z.object({ value: z.string(), quote: z.string() }).nullable(),
  timeline: z.object({ value: z.string(), quote: z.string() }).nullable(),
  routeHints: z.array(z.enum(['study', 'ausbildung', 'nursing', 'skilled_job', 'chancenkarte'])),
});
export type TranscriptClaims = z.infer<typeof TranscriptClaims>;

export const TRANSCRIPT_SYSTEM = `You listen to an applicant's 1-3 minute intro video (transcript given) for a German migration agency.
The video answered: Who are you? What have you studied and worked on? Why Germany? Where do you want to be in two years?
Extract what they SAID. Every claim needs "quote": a short verbatim phrase (3-12 words) copied exactly from the transcript.
value fields are short summaries (under 15 words). Use null when not mentioned. routeHints: which routes their words point to.`;

const CITIES = ['Berlin', 'Munich', 'München', 'Hamburg', 'Cologne', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dusseldorf', 'Aachen', 'Darmstadt', 'Bonn', 'Leipzig', 'Dresden', 'Hannover', 'Nuremberg', 'Heidelberg', 'Karlsruhe', 'Mannheim', 'Essen', 'Dortmund'];

export function extractTranscriptByRules(text: string): TranscriptClaims {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const find = (re: RegExp) => sentences.find((s) => re.test(s)) ?? null;
  const quoteOf = (s: string | null, re: RegExp) => {
    if (!s) return '';
    const m = s.match(re);
    if (!m || m.index == null) return s.slice(0, 80);
    const start = Math.max(0, s.lastIndexOf(' ', Math.max(0, m.index - 20)));
    return s.slice(start, Math.min(s.length, m.index + m[0].length + 25)).trim();
  };
  const gS = find(/\b[ABC][12]\b/);
  const lvl = gS?.match(/\b([ABC][12])\b/)?.[1] ?? null;
  const famS = find(/\b(sister|brother|cousin|uncle|aunt|husband|wife|friend)\b[^.]*\b(in|at)\b/i);
  const famCity = CITIES.find((c) => famS?.includes(c)) ?? null;
  const expS = find(/\b(years?|months?)\b[^.]*\b(experience|work|worked|working)\b|\b(experience|worked|working)\b[^.]*\b(years?|months?)\b/i);
  const yrs = expS?.match(/\b(one|two|three|four|five|six|seven|\d+)\s+years?/i)?.[1];
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
  const whyS = find(/\b(germany|german)\b[^.]*\b(because|want|dream|opportunit|care|future)\b/i) ?? find(/\bwhy germany\b/i);
  const cityS = find(/\b(live|work|move|settle|study)\b[^.]*\bin\b/i);
  const prefCity = CITIES.find((c) => cityS?.includes(c)) ?? famCity;
  const twoS = find(/\btwo years\b|\bin 2 years\b/i);
  const hints: TranscriptClaims['routeHints'] = [];
  if (/nurs|GNM|hospital|patient|elderly care|pflege/i.test(text)) hints.push('nursing');
  if (/master|M\.?Sc|university|study|studies/i.test(text)) hints.push('study');
  if (/ausbildung|apprentice|vocational/i.test(text)) hints.push('ausbildung');
  if (/job|engineer|developer|work as/i.test(text) && !hints.includes('nursing')) hints.push('skilled_job');
  return {
    name: text.match(/\b(?:my name is|i am|i'm)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)?)/)?.[1] ?? null,
    currentRole: null,
    education: find(/\b(diploma|degree|b\.?tech|bachelor|GNM|nursing)\b/i)
      ? { value: (find(/\b(diploma|degree|b\.?tech|bachelor|GNM)\b/i) ?? '').slice(0, 80), quote: quoteOf(find(/\b(diploma|degree|b\.?tech|bachelor|GNM)\b/i), /(diploma|degree|b\.?tech|bachelor|GNM)/i) }
      : null,
    experience: expS ? [{ employer: null, durationText: expS.match(/(about |around |nearly |almost )?\w+ years?/i)?.[0] ?? expS.slice(0, 40), years: yrs ? words[yrs.toLowerCase()] ?? Number(yrs) : null, quote: quoteOf(expS, /\w+ years?/i) }] : [],
    germanLevel: lvl ? { level: lvl, quote: quoteOf(gS, /\b[ABC][12]\b/) } : null,
    english: null,
    whyGermany: whyS ? { value: whyS.slice(0, 90), quote: quoteOf(whyS, /germany/i) } : null,
    familyInGermany: famS && famCity ? { relation: famS.match(/\b(sister|brother|cousin|uncle|aunt|husband|wife|friend)\b/i)![1].toLowerCase(), city: famCity, quote: quoteOf(famS, new RegExp(famCity)) } : null,
    preferredCity: prefCity ? { city: prefCity, quote: quoteOf(cityS ?? famS, new RegExp(prefCity)) } : null,
    twoYears: twoS ? { value: twoS.slice(0, 90), quote: quoteOf(twoS, /two years|2 years/i) } : null,
    timeline: null,
    routeHints: hints,
  };
}
