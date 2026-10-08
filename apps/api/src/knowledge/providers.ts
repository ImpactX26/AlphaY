import type { LinkRef } from '@educaro/shared';

/**
 * The real German places an applicant actually has to go.
 *
 * Educaro sells the course and the exam sitting, and those services stay in the product. But every
 * step also has an institution behind it that is not Educaro and cannot be replaced by it: the exam
 * board that issues the certificate, the bank that opens the blocked account, the office that
 * recognises a nursing diploma, the consulate that stamps the visa. Sending someone to a stand-in
 * page for those is the one place this prototype would be lying, so these are the live sites.
 *
 * Every URL here was opened and checked (2026-10-09). They are the **front doors**, not deep links:
 * a guessed deep path is the thing that 404s in front of somebody, and these sites reorganise often
 * — eight of the deep links tried while writing this file were already dead. A working homepage
 * that puts the thing one click away beats a precise URL that is gone.
 *
 * `blocked` marks sites whose bot protection refuses an automated request (Goethe, ImmobilienScout).
 * They are correct for a person with a browser; they just cannot be checked from a script, so the
 * link checker reports them separately rather than calling them broken.
 */
export interface Provider {
  id: string;
  name: string;
  url: string;
  /** What this one is for, in the words of someone who has not done it before. */
  detail: string;
  /** An official body, as opposed to a commercial provider. Shown so the difference is visible. */
  official: boolean;
  /** Refuses scripted requests; fine in a browser. */
  blocked?: boolean;
}

export type Need =
  | 'german_exam'
  | 'german_course'
  | 'english_exam'
  | 'blocked_account'
  | 'health_insurance'
  | 'visa_appointment'
  | 'recognition'
  | 'recognition_nursing'
  | 'aps'
  | 'uni_application'
  | 'programme_search'
  | 'job_search'
  | 'housing'
  | 'registration'
  | 'transport';

export const PROVIDERS: Record<Need, Provider[]> = {
  german_exam: [
    { id: 'telc', name: 'telc', url: 'https://www.telc.net/en/', detail: 'A1 to C2 certificates accepted for visas, universities and nursing recognition. Exam centres across India.', official: false },
    { id: 'osd', name: 'ÖSD', url: 'https://www.osd.at/en/', detail: 'The Austrian certificate, accepted in Germany the same way. Educaro is an ÖSD exam centre.', official: false },
    { id: 'goethe', name: 'Goethe-Institut', url: 'https://www.goethe.de/', detail: 'The German government’s own institute. Its certificate is accepted everywhere and never expires.', official: true, blocked: true },
    { id: 'testdaf', name: 'TestDaF', url: 'https://www.testdaf.de/', detail: 'The academic German test universities ask for instead of a C1 certificate.', official: true },
  ],
  german_course: [
    { id: 'goethe-course', name: 'Goethe-Institut India', url: 'https://www.goethe.de/', detail: 'Classroom and online courses in Indian cities, taught to the exam they also run.', official: true, blocked: true },
    { id: 'vhs', name: 'Volkshochschule', url: 'https://www.volkshochschule.de/', detail: 'Germany’s public adult-education centres. The cheapest real course once you arrive, and the certificate is the same one.', official: true },
  ],
  english_exam: [
    { id: 'ielts-india', name: 'IELTS India', url: 'https://ielts.idp.com/india', detail: 'Book the test and order the report. Universities want the report, not the score you remember.', official: false },
  ],
  blocked_account: [
    { id: 'fintiba', name: 'Fintiba', url: 'https://www.fintiba.com/', detail: 'Blocked account (Sperrkonto) plus health insurance, opened from India and accepted by every German consulate.', official: false },
    { id: 'expatrio', name: 'Expatrio', url: 'https://www.expatrio.com/', detail: 'The same two things in one package. Compare the fees against Fintiba before you pick.', official: false },
    { id: 'coracle', name: 'Coracle', url: 'https://www.coracle.de/', detail: 'A third blocked-account provider, worth a look if the other two are slow.', official: false },
  ],
  health_insurance: [
    { id: 'tk', name: 'Techniker Krankenkasse', url: 'https://www.tk.de/en', detail: 'Public insurer with an English site. Students pay the reduced rate.', official: false },
    { id: 'aok', name: 'AOK', url: 'https://www.aok.de/pk/', detail: 'The other large public insurer. Same legal cover, different service.', official: false },
    { id: 'mawista', name: 'MAWISTA', url: 'https://www.mawista.com/', detail: 'Travel and incoming cover for the gap before public insurance starts, and for language-course visas.', official: false },
  ],
  visa_appointment: [
    { id: 'vfs-germany', name: 'VFS Global (German visa, India)', url: 'https://visa.vfsglobal.com/ind/en/deu/', detail: 'Where the appointment is actually booked. Slots open months ahead, so book before the papers are finished.', official: false },
    { id: 'german-missions-india', name: 'German Missions in India', url: 'https://india.diplo.de/in-en', detail: 'The embassy and consulates. The checklist that counts is the one on this site for your city.', official: true },
  ],
  recognition: [
    { id: 'anerkennung', name: 'Anerkennung in Deutschland', url: 'https://www.anerkennung-in-deutschland.de/en/', detail: 'The official portal. Its finder names the one office that can recognise your qualification.', official: true },
    { id: 'anabin', name: 'anabin', url: 'https://anabin.kmk.org/', detail: 'The database that says how your degree and university are graded in Germany. Consulates check it.', official: true },
    { id: 'miig-recognition', name: 'Make it in Germany: recognition', url: 'https://www.make-it-in-germany.com/en/working-in-germany/recognition-of-foreign-professional-qualifications', detail: 'The government’s plain-English walkthrough of the whole recognition process.', official: true },
  ],
  recognition_nursing: [
    { id: 'anerkennung-nursing', name: 'Anerkennung in Deutschland', url: 'https://www.anerkennung-in-deutschland.de/en/', detail: 'Nursing is a regulated profession: you cannot work as a nurse until a state office recognises your diploma.', official: true },
    { id: 'miig-recognition-n', name: 'Make it in Germany: recognition', url: 'https://www.make-it-in-germany.com/en/working-in-germany/recognition-of-foreign-professional-qualifications', detail: 'What the deficit notice means and what the knowledge exam involves.', official: true },
  ],
  aps: [
    { id: 'aps-india', name: 'APS India', url: 'https://aps-india.de/', detail: 'The Academic Evaluation Centre. Indian applicants cannot get a student visa without its certificate.', official: true },
  ],
  uni_application: [
    { id: 'uni-assist', name: 'uni-assist', url: 'https://www.uni-assist.de/en/', detail: 'Most German universities take international applications only through here.', official: true },
    { id: 'hochschulkompass', name: 'Hochschulkompass', url: 'https://www.hochschulkompass.de/en/', detail: 'The official register of German universities. If a university is not here, it is not recognised.', official: true },
  ],
  programme_search: [
    { id: 'daad', name: 'DAAD programme database', url: 'https://www2.daad.de/deutschland/studienangebote/international-programmes/en/', detail: 'Every English-taught degree in Germany, filterable by subject and fees.', official: true },
    { id: 'hochschulkompass-p', name: 'Hochschulkompass', url: 'https://www.hochschulkompass.de/en/', detail: 'The official course register, including the German-taught programmes DAAD leaves out.', official: true },
  ],
  job_search: [
    { id: 'arbeitsagentur', name: 'Bundesagentur für Arbeit', url: 'https://www.arbeitsagentur.de/jobsuche/', detail: 'The federal employment agency’s board. The largest in Germany and free.', official: true },
    { id: 'miig-jobs', name: 'Make it in Germany', url: 'https://www.make-it-in-germany.com/en/', detail: 'The government portal for skilled workers, with the visa rules next to the openings.', official: true },
  ],
  housing: [
    { id: 'wg-gesucht', name: 'WG-Gesucht', url: 'https://www.wg-gesucht.de/en/', detail: 'Where shared flats are actually advertised. An English interface and the main site for a first room.', official: false },
    { id: 'immoscout', name: 'ImmobilienScout24', url: 'https://www.immobilienscout24.de/', detail: 'The largest listings site for whole flats. German only, and landlords want a German guarantor.', official: false, blocked: true },
    { id: 'studierendenwerk', name: 'Studierendenwerke', url: 'https://www.studierendenwerke.de/', detail: 'Student halls: the cheapest rooms in any university city. Apply the day you are admitted, the queues are months long.', official: true },
  ],
  registration: [
    { id: 'koeln', name: 'Stadt Köln', url: 'https://www.stadt-koeln.de/', detail: 'Cologne’s city portal, where the Anmeldung appointment is booked.', official: true },
    { id: 'muenchen', name: 'Stadt München', url: 'https://stadt.muenchen.de/', detail: 'Munich’s city portal and its Bürgerbüro appointments.', official: true },
    { id: 'berlin', name: 'Service Berlin', url: 'https://service.berlin.de/', detail: 'Berlin’s appointment system for the Bürgeramt.', official: true },
  ],
  transport: [
    { id: 'deutschlandticket', name: 'Deutschlandticket', url: 'https://www.bahn.de/angebot/regio/deutschland-ticket', detail: 'One monthly ticket for every local train, bus and tram in Germany.', official: true },
  ],
};

/** The links for a step, ready to hang off a gap. */
export function linksFor(need: Need, limit = 2): LinkRef[] {
  return PROVIDERS[need].slice(0, limit).map((p) => ({ label: p.name, url: p.url }));
}

/** One provider by id, for the places that want the detail line too. */
export function provider(id: string): Provider | undefined {
  return Object.values(PROVIDERS).flat().find((p) => p.id === id);
}

/** Every provider, deduplicated by url — what the link checker walks. */
export function allProviders(): Provider[] {
  const seen = new Set<string>();
  return Object.values(PROVIDERS)
    .flat()
    .filter((p) => (seen.has(p.url) ? false : (seen.add(p.url), true)));
}
