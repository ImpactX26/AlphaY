/**
 * The German words this product refuses to translate, and what each one means.
 *
 * Every other service either drops the German entirely — leaving somebody unable to recognise the
 * word on the form in front of them — or leaves it untranslated and assumes they will cope. Both
 * are wrong in the same way: the word on the letter from the Ausländerbehörde is "Ausländerbehörde",
 * and a product that has only ever said "foreigners authority" has not prepared anyone for the
 * envelope.
 *
 * So the German stays and the meaning travels with it. Shared rather than living in the web app,
 * because the agent, the letters and the screen all need the same wording — three descriptions of
 * the Anmeldung that disagree is three chances to be wrong.
 *
 * Kept to terms that actually appear in this product's own output. A dictionary of four hundred
 * words nobody will ever meet is a different project.
 */

export interface GlossEntry {
  /** As it is written on the form. */
  term: string;
  /** Other spellings and the plural, so the matcher finds it in a sentence. */
  also?: string[];
  /** Five to fifteen words. It is a tooltip, not an article. */
  short: string;
  /** The sentence somebody needs the first time they meet it. */
  long?: string;
}

export const GLOSSARY: GlossEntry[] = [
  { term: 'Anmeldung', also: ['Anmeldebestätigung'], short: 'registering your address', long: 'Registering where you live, at the Bürgeramt, within two weeks of moving in. Almost everything else — tax ID, bank account, health insurance — waits on it.' },
  { term: 'Bürgeramt', also: ['Buergeramt', 'Bürgerbüro', 'Bürgerservice', 'Kundenzentrum'], short: 'the citizens office', long: 'The local council office where you register your address. Appointments can be weeks out, so book before you land if the city allows it.' },
  { term: 'Ausländerbehörde', also: ['Auslaenderbehoerde', 'Ausländeramt', 'Auslaenderamt'], short: 'the foreigners authority', long: 'The office that issues and extends your residence permit. Different from the Bürgeramt, and the one you must never miss an appointment with.' },
  { term: 'Anerkennung', also: ['Anerkennungsbescheid'], short: 'getting your qualification recognised', long: 'The formal process that makes your Indian qualification equivalent to the German one. For nursing it is what stands between you and the licence to practise.' },
  { term: 'Berufserlaubnis', short: 'temporary licence to practise', long: 'A time-limited permission to work in a regulated profession while your full recognition is still running.' },
  { term: 'Sperrkonto', short: 'blocked account', long: 'A bank account holding a year of living costs that you may only draw a fixed amount from each month. The visa is not granted without it.' },
  { term: 'Verpflichtungserklärung', also: ['Verpflichtungserklaerung'], short: 'a formal sponsorship undertaking', long: 'A relative in Germany signs at their foreigners authority to cover your costs. It replaces the blocked account entirely.' },
  { term: 'Kaltmiete', short: 'rent before bills', long: 'The rent on its own. Your deposit is capped at three months of this, not of the full amount you pay.' },
  { term: 'Warmmiete', short: 'rent including heating and service charges', long: 'What actually leaves your account each month. Electricity and internet are usually still separate.' },
  { term: 'Nebenkosten', also: ['Betriebskosten'], short: 'the service charges', long: 'Heating, water, rubbish, building upkeep. Billed yearly, so expect a settlement that is either a refund or a bill.' },
  { term: 'Kaution', short: 'the rental deposit', long: 'Capped by law at three months of cold rent, payable in three instalments, and never before a signed contract.' },
  { term: 'Wohnungsgeberbestätigung', also: ['Wohnungsgeberbescheinigung'], short: 'the landlord’s confirmation that you live there', long: 'A short form your landlord signs. You cannot do the Anmeldung without it, so ask for it the day you get the keys.' },
  { term: 'Krankenkasse', short: 'your health insurer', long: 'Health insurance is compulsory. The public insurers are broadly interchangeable; pick one and it follows you between jobs.' },
  { term: 'Steuer-ID', also: ['Steueridentifikationsnummer', 'Tax ID'], short: 'your tax number', long: 'Arrives by post a few weeks after the Anmeldung. Your employer needs it or you are taxed at the highest rate until it turns up.' },
  { term: 'Probezeit', short: 'the probation period', long: 'Up to six months, during which either side can end the contract with two weeks notice. It may not be longer than six months, whatever a contract says.' },
  { term: 'Kündigungsfrist', also: ['Kuendigungsfrist'], short: 'the notice period', long: 'Yours may never be longer than your employer’s. If a contract makes it longer, that clause is void.' },
  { term: 'Arbeitsvertrag', short: 'the employment contract' },
  { term: 'Mietvertrag', short: 'the rental contract' },
  { term: 'Vertragsstrafe', short: 'a penalty clause', long: 'A fine for breaking the contract. In a pre-written contract it must be proportionate and precisely defined, and is often unenforceable.' },
  { term: 'Ausschlussfrist', also: ['Verfallfrist'], short: 'the deadline to claim unpaid wages', long: 'If you do not claim within it, the money is gone. It must be at least three months, and it can never apply to the minimum wage.' },
  { term: 'Überstunden', also: ['Ueberstunden'], short: 'overtime', long: 'A blanket "all overtime is included in the salary" clause is generally invalid. Overtime is paid or given back as time off.' },
  { term: 'Nebentätigkeit', also: ['Nebentaetigkeit'], short: 'a second job', long: 'A total ban is void. An employer may only restrict work that genuinely conflicts with yours.' },
  { term: 'Betriebsrat', short: 'the works council', long: 'Elected staff representatives. Most hospitals have one, and they act for you free of charge.' },
  { term: 'Schufa', short: 'your German credit record', long: 'Built from German accounts and contracts. You have none on arrival, which is why landlords ask for other guarantees in the first year.' },
  { term: 'Ausbildung', short: 'paid vocational training', long: 'Three years of paid training that ends with the German qualification itself — low pay while you learn, and no recognition fight afterwards.' },
  { term: 'Chancenkarte', short: 'the opportunity card', long: 'A points-based visa giving you a year in Germany to find qualified work, funded entirely by you.' },
  { term: 'Deutschlandticket', short: 'the nationwide transport ticket', long: 'One monthly ticket for all local and regional public transport across Germany.' },
  { term: 'Rundfunkbeitrag', short: 'the broadcasting fee', long: 'Charged per flat, not per person, so flatmates split one bill. It is not optional.' },
  { term: 'Volkshochschule', also: ['VHS'], short: 'the adult education centre', long: 'Council-run evening classes. The cheapest serious German courses in most cities.' },
  { term: 'Pflegefachkraft', short: 'a qualified nurse' },
  { term: 'TVöD', also: ['TVoeD', 'TVöD-P'], short: 'the public-sector pay agreement', long: 'The collective agreement most public hospitals pay by. It fixes your pay group, your supplements and your 30 days of holiday.' },
  { term: 'Kenntnisprüfung', also: ['Kenntnispruefung'], short: 'the knowledge exam', long: 'The practical and oral exam taken when your qualification is not accepted as equivalent outright.' },
  { term: 'Approbation', short: 'full professional licence' },
  { term: 'uni-assist', short: 'the shared university application service', long: 'Most German universities take international applications through it, and it checks your documents before the university sees them.' },
  { term: 'APS', also: ['Akademische Prüfstelle', 'Akademische Pruefstelle'], short: 'the academic evaluation certificate', long: 'Indian applicants need it before applying to study. It takes four to six weeks and gates everything after it.' },
  { term: 'Aufenthaltstitel', short: 'your residence permit' },
  { term: 'Arbeitszeitgesetz', short: 'the working hours law', long: 'Caps the working day at 8 hours, extendable to 10 only if the six-month average stays at 8.' },
  { term: 'Schönheitsreparaturen', also: ['Schoenheitsreparaturen'], short: 'cosmetic repairs and redecorating', long: 'Clauses with rigid deadlines are void, and you cannot be made to redecorate a flat you received unrenovated.' },
  { term: 'Untervermietung', short: 'subletting', long: 'You have a statutory right to ask to sublet part of your flat where you have a good reason.' },
  { term: 'Bescheid', short: 'an official decision letter', long: 'The formal written decision from an authority. It carries a deadline to object, so never leave one unopened.' },
  { term: 'Defizitbescheid', short: 'a notice of what is missing', long: 'The recognition office saying your qualification is not yet equivalent and naming exactly what would close the gap.' },
];

const NORMALISE = (s: string) =>
  s
    .normalize('NFC')
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u');

/**
 * Every spelling that should resolve to an entry.
 *
 * Folded, because these words reach us in three forms — typed with umlauts, transliterated, and
 * stripped — and an applicant searching for "Burgeramt" is asking about the Bürgeramt.
 */
const INDEX = new Map<string, GlossEntry>();
for (const e of GLOSSARY) for (const form of [e.term, ...(e.also ?? [])]) INDEX.set(NORMALISE(form), e);

export function lookupTerm(word: string): GlossEntry | null {
  return INDEX.get(NORMALISE(word.replace(/[^\p{L}\p{N}-]/gu, ''))) ?? null;
}

/** Longest first, so "Akademische Prüfstelle" wins over "APS" inside the same sentence. */
export const GLOSSARY_TERMS: string[] = [...INDEX.keys()].sort((a, b) => b.length - a.length);
