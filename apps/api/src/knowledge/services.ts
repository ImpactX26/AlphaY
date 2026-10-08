import type { ServiceRef } from '@educaro/shared';

/**
 * Educaro's own services, from educaro.de (checked 2026-10-08, see research/knowledge.md section A).
 * Every gap routes to one of these where one exists.
 */
export interface EducaroService extends ServiceRef {
  for: ('nursing' | 'ausbildung' | 'study' | 'skilled_job' | 'chancenkarte' | 'all')[];
  detail: string;
}

export const EDUCARO_CONTACT = {
  indiaEmail: 'india@educaro.de',
  indiaPhone: '+91 96 1154 3642',
  indiaOffice: 'Hebbal Kempapura, Bangalore',
  germanyEmail: 'info@educaro.de',
};

export const SERVICES: Record<string, EducaroService> = {
  'nursing-program': {
    id: 'nursing-program',
    name: 'Educaro Nursing Program',
    url: 'https://www.educaro.de/india/nursing-program/',
    for: ['nursing'],
    detail:
      'Free for nurses (the employer pays). German online in India up to B1, interviews with German hospitals, a permanent contract, visa and relocation; B2 and the knowledge exam in Germany. Needs a B.Sc. Nursing (Post Basic B.Sc., B.Sc. or M.Sc.).',
  },
  'ausbildung-program': {
    id: 'ausbildung-program',
    name: 'Ausbildung program',
    url: 'https://www.educaro.de/india/ausbildung/',
    for: ['ausbildung', 'nursing'],
    detail: 'Paid vocational training in German healthcare (about €1,000 to €1,500 a month, 2.5 to 3 years), with German to B1/B2, visa and relocation help.',
  },
  'study-guidance': {
    id: 'study-guidance',
    name: 'University Pathway Program',
    url: 'https://www.educaro.de/india/study-in-germany/',
    for: ['study'],
    detail: 'Programme search, small-group German lessons, university application and documents, pre-enrolment, a student-residence room and visa preparation.',
  },
  'skilled-worker-placement': {
    id: 'skilled-worker-placement',
    name: 'Work in Germany as a qualified professional',
    url: 'https://www.educaro.de/work-in-germany/',
    for: ['skilled_job', 'chancenkarte'],
    detail: 'Recognition, language training, visa papers, accommodation and matching with German employers for people with a completed vocational or academic qualification.',
  },
  'german-courses': {
    id: 'german-courses',
    name: 'Online German course A1 to B2',
    url: 'https://www.educaro.de/india/',
    for: ['all'],
    detail: 'Live classes on Zoom, about 7.5 hours a week, 2 to 4 sessions. A1 to B1 takes about 9 months. Free inside the nursing and Ausbildung programs.',
  },
  'osd-exam': {
    id: 'osd-exam',
    name: 'ÖSD exam at Educaro',
    url: 'https://www.educaro.de/sprachkurse/',
    for: ['all'],
    detail: "Educaro is an official ÖSD exam centre. ÖSD certificates are recognised by German embassies.",
  },
  anerkennung: {
    id: 'anerkennung',
    name: 'Anerkennung support (educaro Akademie)',
    url: 'https://www.educaro.de/anerkennung/',
    for: ['nursing', 'skilled_job'],
    detail: 'Educaro runs the whole recognition procedure: documents, application, authorities, the B2 nursing course and knowledge-exam preparation (free for nurse and employer through a Bildungsgutschein).',
  },
  'integration-companion': {
    id: 'integration-companion',
    name: 'Integration companion',
    url: 'https://www.educaro.de/fachkrafte/',
    for: ['all'],
    detail: 'Airport pick-up, accommodation, SIM card, bank account, Anmeldung and health insurance appointments, with a personal contact until recognition.',
  },
  'intercultural-workshop': {
    id: 'intercultural-workshop',
    name: 'Intercultural workshop',
    url: 'https://www.educaro.de/interkulturelle-workshops/',
    for: ['all'],
    detail: 'Hands-on workshops on German workplace culture and communication in mixed teams.',
  },
  'info-events': {
    id: 'info-events',
    name: 'Free webinar or Open Day in Bangalore',
    url: 'https://www.educaro.de/india/event/',
    for: ['all'],
    detail: 'Free online info events and walk-in Open Days at the Bangalore (Hebbal) office, with document checks.',
  },
  consultant: {
    id: 'consultant',
    name: 'Consultant call',
    url: 'https://www.educaro.de/india/',
    for: ['all'],
    detail: `A consultation with the Educaro India team (${EDUCARO_CONTACT.indiaEmail}), who receive the agent’s brief.`,
  },
};

export function service(id: string): ServiceRef | undefined {
  const s = SERVICES[id];
  return s ? { id: s.id, name: s.name, url: s.url, why: s.detail } : undefined;
}

export function servicesForRoute(route: string | null): ServiceRef[] {
  const ids: Record<string, string[]> = {
    nursing: ['nursing-program', 'german-courses', 'osd-exam', 'anerkennung', 'consultant'],
    ausbildung: ['ausbildung-program', 'german-courses', 'osd-exam', 'consultant'],
    study: ['study-guidance', 'german-courses', 'consultant'],
    skilled_job: ['skilled-worker-placement', 'german-courses', 'osd-exam', 'anerkennung', 'consultant'],
    chancenkarte: ['skilled-worker-placement', 'german-courses', 'osd-exam', 'info-events', 'consultant'],
  };
  return (ids[route ?? ''] ?? ['german-courses', 'info-events', 'consultant']).map((i) => service(i)!).filter(Boolean);
}
