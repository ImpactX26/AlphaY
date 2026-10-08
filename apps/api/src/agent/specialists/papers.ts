import { ROUTES } from '../../knowledge/routes';
import { servicesForRoute, service } from '../../knowledge/services';
import { linksFor } from '../../knowledge/providers';
import { bestFact } from '../state.service';
import { cite, type Kit, type SpecialistResult } from './kit';

/** Exams and language: what is done, pending or not needed, and where to book. */
export async function examsSpecialist(kit: Kit): Promise<SpecialistResult> {
  const route = kit.state.applicant.route;
  const lang = kit.report.language;
  const kinds = new Set(kit.state.files.filter((f) => f.status === 'done').map((f) => f.kind));
  const exams: { name: string; status: 'done' | 'pending' | 'not_started' | 'not_needed'; note: string; where?: string; url?: string }[] = [];
  const spec = route ? ROUTES[route as keyof typeof ROUTES] : null;

  if (spec?.german) {
    const target = spec.german.need;
    exams.push({
      name: `German ${target} (ÖSD, Goethe or telc)`,
      status: lang.proven && lang.proven >= target ? 'done' : lang.claimed ? 'pending' : 'not_started',
      note: lang.proven ? `${lang.proven} certificate on file` : lang.claimed ? `${lang.claimed} claimed, no certificate yet` : 'Not started',
      where: "ÖSD exam centre at Educaro",
      url: service('osd-exam')!.url,
    });
    if (spec.german.then) exams.push({ name: `German ${spec.german.then}`, status: 'not_started', note: 'After B1, for full nursing registration', where: 'Educaro online batch, then ÖSD at Educaro', url: service('german-courses')!.url });
  } else {
    exams.push({ name: 'German', status: 'not_needed', note: 'Not needed for an English-taught programme. A1 still helps with daily life.' });
  }
  if (route === 'study') {
    const eng = kit.state.facts.filter((f) => f.key === 'language.english');
    exams.push({
      name: 'IELTS Academic (6.5) or TOEFL iBT',
      status: eng.some((f) => f.sourceKind === 'document') ? 'done' : eng.length ? 'pending' : 'not_started',
      note: eng.some((f) => f.sourceKind === 'document') ? 'Report on file' : eng.length ? `${eng[0].value} claimed, report not uploaded` : 'Book a test date',
    });
    exams.push({ name: 'APS certificate', status: kinds.has('aps_certificate') ? 'done' : 'not_started', note: kinds.has('aps_certificate') ? 'On file' : 'Start now: every application waits for it', url: 'https://aps-india.de/' });
    exams.push({ name: 'GRE', status: 'not_needed', note: 'Not required by most public German universities' });
    exams.push({ name: 'TestDaF', status: 'not_needed', note: 'Only for German-taught programmes' });
  }
  if (route === 'nursing') {
    exams.push({ name: 'Knowledge exam (Kenntnisprüfung) or adaptation course', status: 'not_started', note: 'Decided by the recognition notice, taken in Germany' });
  }
  const done = exams.filter((e) => e.status === 'done').length;
  return { summary: `Exams: ${done} done, ${exams.filter((e) => e.status === 'pending' || e.status === 'not_started').length} open`, output: { exams, language: lang } };
}

/** Recognition (Anerkennung) for regulated professions. */
export async function recognitionSpecialist(kit: Kit): Promise<SpecialistResult> {
  const route = kit.state.applicant.route;
  if (route !== 'nursing' && route !== 'skilled_job') return { summary: 'Recognition: not needed for this route', output: { needed: false } };
  const city = bestFact(kit.state, 'family.germany')?.data as any;
  const lang = await cite(kit, 'nursing_language');
  const steps = route === 'nursing'
    ? [
        'educaro Akademie collects your diploma, marksheets, registration and experience letters (translated and certified)',
        'The state authority for health professions compares your training with the German one',
        'You receive a notice: usually a deficit notice (Defizitbescheid) listing what is missing',
        'You close the gap in Germany: an adaptation course (Anpassungslehrgang) or a knowledge exam (Kenntnisprüfung)',
        'Full recognition as Pflegefachfrau / Pflegefachmann, with German B2',
      ]
    : ['Check whether your profession is regulated', 'If regulated, apply for recognition; if not, your degree must be comparable (anabin)'];
  return {
    summary: `Recognition: ${route === 'nursing' ? 'nursing recognition, likely a deficit notice then adaptation course or knowledge exam' : 'check regulation'}`,
    output: {
      needed: true,
      authority: route === 'nursing' ? `State authority for health professions${city?.city ? ` (for ${city.city})` : ''}` : 'Depends on the profession',
      steps,
      duration: 'about 3 to 4 months for the decision after a complete application',
      language: lang,
      service: service('anerkennung'),
      links: linksFor('recognition_nursing'),
    },
  };
}

/** Visa and papers: likely visa type, checklist, appointment route and risks. */
export async function visaSpecialist(kit: Kit): Promise<SpecialistResult> {
  const route = kit.state.applicant.route ?? 'skilled_job';
  const kinds = new Set(kit.state.files.filter((f) => f.status === 'done').map((f) => f.kind));
  const visas: Record<string, { type: string; papers: [string, string | null][]; risks: string[] }> = {
    nursing: {
      type: 'Visa for recognition measures (§16d) or skilled worker visa (§18a) once recognised',
      papers: [['Passport', 'passport'], ['Recognition notice (Defizitbescheid)', null], ['Employment contract or offer', null], ['German certificate', 'language_certificate'], ['Proof of accommodation', null]],
      risks: ['The residence permit may be tied to one employer at first: changing jobs needs approval', 'Names must match across all papers'],
    },
    study: {
      type: 'Student visa (§16b)',
      papers: [['Passport', 'passport'], ['Admission letter', null], ['APS certificate', 'aps_certificate'], ['Blocked account confirmation', null], ['Health insurance', null], ['English test report', 'language_certificate']],
      risks: ['Appointments fill up weeks ahead in summer', 'The blocked account must be funded before the appointment'],
    },
    ausbildung: {
      type: 'Visa for vocational training (§16a)',
      papers: [['Passport', 'passport'], ['Ausbildung contract', null], ['German certificate (B1)', 'language_certificate'], ['Proof of funds if the pay is low', null]],
      risks: ['If the training pay is below the required amount, extra proof of funds is needed'],
    },
    skilled_job: {
      type: 'Skilled worker visa (§18a/§18b) or EU Blue Card',
      papers: [['Passport', 'passport'], ['Employment contract', null], ['Degree certificate', 'degree_certificate'], ['Recognition or comparability statement', null]],
      risks: ['Salary must meet the threshold for a Blue Card'],
    },
    chancenkarte: {
      type: 'Opportunity Card (§20a)',
      papers: [['Passport', 'passport'], ['Degree or vocational certificate', 'degree_certificate'], ['Language certificate', 'language_certificate'], ['Proof of funds', null], ['Points evidence', null]],
      risks: ['Proof of funds for the whole stay is required', 'Work is limited to part-time while searching'],
    },
  };
  const v = visas[route] ?? visas.skilled_job;
  const checklist = v.papers.map(([label, kind]) => ({ label, status: kind && kinds.has(kind) ? 'verified' : 'missing' }));
  return {
    summary: `Visa: ${v.type}`,
    output: {
      visaType: v.type,
      checklist,
      appointment: 'Book at the German mission responsible for your state, through VFS Global',
      risks: v.risks,
      links: [{ label: 'German missions in India', url: 'https://india.diplo.de/' }],
    },
  };
}

/** The Educaro services relevant to this applicant, in order. */
export function routeServices(route: string | null) {
  return servicesForRoute(route);
}
