/**
 * The mock "agent" composes each applicant's screen from their state. In live mode the real agent
 * does this server-side; these words exist only in the mock layer.
 */
import type {
  ArrivalBlock,
  Block,
  BudgetBlock,
  ChecklistBlock,
  DocumentsBlock,
  GapPlanBlock,
  LettersBlock,
  MatrixBlock,
  OpportunitiesBlock,
  PlacesBlock,
  QuestionBlock,
  ReadinessBlock,
  Screen,
  ServicesBlock,
  ShortlistBlock,
  TimelineBlock,
  TruthMapBlock,
} from '@educaro/shared';
import { DOC_KIND_LABEL, type DocKind } from '@educaro/shared';
import type { MockApplicant } from './db';
import { ANANYA_OPENING_ID, PROGRAMMES, SERVICES } from './personas';

const daysLeft = (date: string | null) => (date ? Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000) : null);

export function readKinds(a: MockApplicant): Set<string> {
  const s = new Set<string>();
  for (const f of a.files) if (f.status === 'done' || f.status === 'unclear') s.add(f.kind);
  return s;
}

function documentsBlock(a: MockApplicant, title = 'Your files', body?: string): DocumentsBlock {
  return {
    id: 'documents',
    type: 'documents',
    title,
    body,
    items: a.files.map((f) => ({
      id: f.id,
      name: f.originalName,
      kind: f.status === 'queued' ? 'Waiting to be read' : (f.kindLabel ?? DOC_KIND_LABEL[f.kind as DocKind] ?? f.kind),
      status: f.status,
    })),
  };
}

function truthBlock(a: MockApplicant, body?: string): TruthMapBlock {
  return {
    id: 'truth_map',
    type: 'truth_map',
    title: 'What you said, wrote and proved',
    body: body ?? 'Only a document makes a fact Verified. A conflict becomes one polite question, never an accusation.',
    rows: a.truth,
  };
}

function questionBlocks(a: MockApplicant): QuestionBlock[] {
  return a.questions
    .filter((q) => q.status === 'open')
    .slice(0, 2)
    .map((q) => ({
      id: `question_${q.id}`,
      type: 'question',
      title: 'One question',
      questionId: q.id,
      prompt: q.prompt,
      why: q.why,
      options: q.options,
    }));
}

function gapBlock(a: MockApplicant, title: string, body: string): GapPlanBlock {
  return {
    id: 'gap_plan',
    type: 'gap_plan',
    title,
    body,
    gaps: a.gaps
      .filter((g) => g.status !== 'done')
      .map((g) => ({
        id: g.id,
        title: g.title,
        what: g.what,
        where: g.where,
        howLong: g.howLong,
        cost: g.cost,
        links: g.links,
        service: g.service ?? undefined,
      })),
  };
}

function readinessBlock(a: MockApplicant, body: string): ReadinessBlock {
  return { id: 'readiness', type: 'readiness', title: 'How ready you are', body, ...a.readiness };
}

function lettersBlock(a: MockApplicant): LettersBlock | null {
  const drafts = a.approvals.filter((x) => x.kind === 'email');
  if (!drafts.length) return null;
  const pending = drafts.some((d) => d.status === 'pending' && !d.applicantApprovedAt);
  return {
    id: 'letters',
    type: 'letters',
    title: pending ? 'Ready for your review' : 'Your applications',
    body: pending
      ? 'I drafted this from your verified facts and the employer\'s own words. Nothing is sent until you approve.'
      : 'Sent from Educaro\'s mail with you in CC. Replies land in your Emails.',
    drafts: drafts.map((d) => ({
      approvalId: d.id,
      title: d.title,
      to: typeof d.payload.to === 'string' ? d.payload.to : '',
      status: d.status === 'pending' && d.applicantApprovedAt ? 'waiting for Educaro' : d.status,
    })),
  };
}

function shortlistBlock(a: MockApplicant, title: string): ShortlistBlock | null {
  if (!a.shortlist.length) return null;
  return {
    id: 'shortlist',
    type: 'shortlist',
    title,
    items: a.shortlist.map((s) => ({
      id: s.id,
      title: s.title,
      subtitle: s.subtitle,
      status: s.status === 'checking' ? 'checking' : s.status === 'ready' ? 'ready' : 'gaps',
      gapCount: s.gapCount,
      url: s.url,
    })),
  };
}

function matrixBlock(a: MockApplicant, shortlistId: string, body: string): MatrixBlock | null {
  const s = a.shortlist.find((x) => x.id === shortlistId);
  if (!s?.matrix) return null;
  return {
    id: `matrix_${s.id}`,
    type: 'requirement_matrix',
    title: `${s.title} · ${s.subtitle.split(' · ').pop() ?? ''}`,
    body,
    shortlistId: s.id,
    rows: s.matrix.rows,
    exams: s.matrix.exams,
    deadline: s.matrix.deadline ? { ...s.matrix.deadline, daysLeft: daysLeft(s.matrix.deadline.date) } : undefined,
  };
}

function timelineFromCalendar(a: MockApplicant, title: string, extra: TimelineBlock['items'] = []): TimelineBlock | null {
  const items = [
    ...extra,
    ...a.calendar.map((e) => ({ date: e.startsAt, label: e.title, kind: e.kind })),
  ].sort((x, y) => x.date.localeCompare(y.date));
  if (!items.length) return null;
  return { id: 'timeline', type: 'timeline', title, items };
}

function base(a: MockApplicant, mode: Screen['mode'], headline: string, footnote: string, blocks: (Block | null | false | undefined)[]): Screen {
  return {
    applicantId: a.id,
    version: a.screenVersion,
    mode,
    headline,
    footnote,
    blocks: blocks.filter((b): b is Block => Boolean(b)),
    composedBy: 'agent',
    updatedAt: new Date().toISOString(),
  };
}

// =====================================================================================
// Ananya
// =====================================================================================

function ananyaChecklist(a: MockApplicant): ChecklistBlock {
  const read = readKinds(a);
  const nameConflict = read.has('passport') && read.has('diploma_certificate');
  const items: ChecklistBlock['items'] = [
    { label: 'GNM diploma', status: read.has('diploma_certificate') ? 'verified' : 'missing' },
    { label: 'Experience letter', status: read.has('experience_letter') ? 'verified' : 'missing' },
    { label: 'Passport', status: read.has('passport') ? 'verified' : 'missing' },
    {
      label: 'Nursing council registration',
      status: read.has('registration_certificate') ? 'verified' : 'missing',
      note: read.has('registration_certificate') ? undefined : 'Asked for by the recognition office',
    },
    { label: 'German B1', status: a.facts.some((f) => f.key === 'german_cert') ? 'verified' : 'planned', note: 'Educaro B1 batch, then ÖSD B1' },
  ];
  if (nameConflict) items.push({ label: 'Same-person affidavit', status: 'planned', note: 'Notary in Kochi, one day' });
  return { id: 'papers', type: 'checklist', title: 'Papers', items };
}

function ananyaOpportunities(a: MockApplicant): OpportunitiesBlock {
  const sl = (id: string) => a.shortlist.some((s) => s.id === `sl_${id}`);
  return {
    id: 'opportunities',
    type: 'opportunities',
    title: 'Partner employers near Cologne',
    body: 'Your sister lives in Cologne, so these show first. All of them support recognition.',
    items: [
      {
        id: ANANYA_OPENING_ID,
        title: 'Pflegefachkraft in Anerkennung',
        subtitle: 'Rheinblick Seniorenzentrum · Köln-Ehrenfeld · start Sept 2027',
        url: 'https://www.educaro.de/india/',
        kind: 'opening',
        why: 'Elderly care, takes nurses in recognition from B1. 15 minutes from your sister.',
        shortlisted: sl(ANANYA_OPENING_ID),
      },
      {
        id: 'open_rwk',
        title: 'Pflegefachkraft Geriatrie',
        subtitle: 'Rhein-Wupper Klinikum · Leverkusen · start Oct 2027',
        url: 'https://www.educaro.de/india/',
        kind: 'opening',
        why: 'Geriatric ward, adaptation course paid by the employer. 25 minutes by train.',
        shortlisted: sl('open_rwk'),
      },
    ],
  };
}

function ananyaServices(): ServicesBlock {
  return {
    id: 'services',
    type: 'services',
    title: 'Educaro can take it from here',
    services: [
      { ...SERVICES.nursing, why: 'Placement with a partner employer, with recognition support' },
      { ...SERVICES.german, why: 'Online B1 batch, evenings India time. Next batch starts 2 November.' },
      { ...SERVICES.osd, why: 'Sit ÖSD B1 at Educaro\'s own exam centre' },
      { ...SERVICES.anerkennung, why: 'They prepare your recognition file for NRW' },
      { ...SERVICES.consultant, why: '30 minutes with a nursing consultant' },
    ],
  };
}

export function composeAnanya(a: MockApplicant): Screen {
  if (a.profile.mode === 'germany') return composeGermany(a);
  const composed = a.flags.composed === true;
  if (!a.files.length) {
    return base(
      a,
      'onboarding',
      'Hi Ananya. Tell me your story: one short video and every document you have.',
      'Files stay on Educaro\'s server. Nothing personal goes into web searches.',
      [],
    );
  }
  if (!composed) {
    const reading = a.files.some((f) => f.status === 'queued' || f.status === 'reading');
    return base(
      a,
      'onboarding',
      reading ? 'Reading your files. Your screen builds itself as I go.' : 'Cross-checking what you said, wrote and proved.',
      'Every sentence and every file becomes a claim with a source.',
      [
        documentsBlock(a, 'Your files', reading ? 'Sorted on arrival. Phone photos are fine.' : undefined),
        a.truth.length > 0 && truthBlock(a),
        ...questionBlocks(a),
      ],
    );
  }

  const interview = a.flags.interview === true;
  const letters = lettersBlock(a);
  const letterPending = letters?.drafts.some((d) => d.status === 'pending');
  const openQuestions = questionBlocks(a);
  const opening = a.shortlist.find((s) => s.id === `sl_${ANANYA_OPENING_ID}`);
  const matrix = opening ? matrixBlock(a, opening.id, 'Read from the employer\'s posting and your papers.') : null;

  const nextStep: Block = interview
    ? {
        id: 'next_interview',
        type: 'next_step',
        title: 'Your next step',
        body: 'Practise the interview with the coach: elderly care, your ward experience and why Cologne. Twenty minutes is enough.',
        actions: [
          { label: 'Practise now', kind: 'link', value: '/app/interview' },
          { label: 'What will they ask?', kind: 'chat', value: 'What will they ask in the interview?' },
        ],
        tags: ['ai'],
      }
    : {
        id: 'next_b1',
        type: 'next_step',
        title: 'Your next step',
        body: 'Join an Educaro online B1 batch, then sit the ÖSD B1 exam at Educaro\'s own exam centre.',
        actions: [
          { label: 'Show batches', kind: 'service', value: SERVICES.german.url },
          { label: 'Why B1 first?', kind: 'chat', value: 'Why B1 first?' },
        ],
        tags: ['ai'],
        service: { ...SERVICES.german, why: 'Next batch starts 2 November, evenings India time.' },
      };

  const headline = interview
    ? 'Ananya, Rheinblick invited you to a video interview. It is in your calendar.'
    : letterPending
      ? 'Ananya, your Bewerbung to Rheinblick is ready. Read it, change anything, then approve.'
      : 'Ananya, your diploma can be recognised in Germany. German is your long pole: you need B1, then B2 for nursing.';

  const route: Block = {
    id: 'route',
    type: 'route',
    title: 'Your route',
    body: 'Nursing with recognition fits best. If two routes were close, I would ask.',
    primary: 'nursing',
    alternatives: ['ausbildung'],
    reasons: [
      'GNM diploma and three years on a hospital ward count towards recognition',
      'Elderly care is what you want, and care homes in NRW hire nurses in recognition',
      'Your sister in Cologne makes the first months easier',
    ],
  };

  return base(a, 'planning', headline, 'Your sister lives in Cologne, so partner employers near Cologne show first.', [
    interview && timelineFromCalendar(a, 'Coming up'),
    letterPending && letters,
    nextStep,
    ...openQuestions,
    matrix,
    ananyaChecklist(a),
    truthBlock(a),
    route,
    readinessBlock(a, 'Computed from your checks, not guessed by the model.'),
    gapBlock(a, 'Your plan', 'Every gap has a fix, most of them inside Educaro.'),
    ananyaOpportunities(a),
    shortlistBlock(a, 'Your shortlist'),
    !letterPending && letters,
    !interview && timelineFromCalendar(a, 'Coming up'),
    ananyaServices(),
    documentsBlock(a, 'Your files'),
  ]);
}

function composeGermany(a: MockApplicant): Screen {
  const city = a.profile.targetCity ?? 'Köln';
  const arrival: ArrivalBlock = {
    id: 'arrival',
    type: 'arrival',
    title: 'Your first weeks',
    body: 'In order. Tick things off as you go; I adjust the rest.',
    phases: [
      {
        title: 'Before the flight',
        items: [
          { label: 'Papers in your hand luggage', done: true, note: 'Passport with visa, contract, diploma, recognition letter' },
          { label: 'Health insurance from day one', done: true, note: 'Your employer registers you. Travel insurance covers the gap.' },
          { label: 'Address for the first night', done: true, note: 'With your sister in Ehrenfeld' },
          { label: 'Winter clothes for Köln', done: false, note: 'Wet, around 2 °C. A waterproof jacket beats a heavy coat.' },
        ],
      },
      {
        title: 'First two weeks',
        items: [
          { label: 'Anmeldung at Bürgeramt Ehrenfeld', done: false, note: 'Registering your address. Bring the landlord form (Wohnungsgeberbestätigung).' },
          { label: 'SIM card', done: true },
          { label: 'Bank account', done: false, note: 'Needed for your salary. Online banks open in a day.' },
          { label: 'Health insurance card', done: false },
          { label: 'Deutschlandticket', done: false, note: '€58 a month, all local transport in Germany' },
          { label: 'Tax ID by post', done: false, note: 'Arrives about two weeks after Anmeldung. Give it to your employer.' },
        ],
      },
      {
        title: 'Feel at home',
        items: [
          { label: 'Indian groceries near you', done: false, note: 'Two within 2 km, on the map below' },
          { label: 'Join #koeln-pflege-sep27 on Discord', done: true, note: 'Nurses who arrived this year' },
          { label: 'Intercultural workshop', done: false, note: 'Educaro, first Saturday of the month' },
        ],
      },
    ],
  };
  const places: PlacesBlock = {
    id: 'places',
    type: 'places',
    title: 'Around your new address',
    body: 'From OpenStreetMap, for Ehrenfeld.',
    city,
    center: { lat: 50.9497, lon: 6.9139 },
    groups: [
      {
        kind: 'office',
        label: 'Offices',
        places: [
          { name: 'Bürgeramt Ehrenfeld', lat: 50.9496, lon: 6.9174, address: 'Venloer Str. 419', distanceM: 300 },
          { name: 'Ausländeramt Köln', lat: 50.9374, lon: 7.0003, address: 'Dillenburger Str. 56', distanceM: 6400 },
        ],
      },
      {
        kind: 'grocery',
        label: 'Indian groceries',
        places: [
          { name: 'Spice Bazaar', lat: 50.9488, lon: 6.9235, address: 'Venloer Str. 312', distanceM: 700 },
          { name: 'Kerala Stores', lat: 50.9409, lon: 6.9393, address: 'Ehrenstraße 41', distanceM: 2100 },
        ],
      },
      {
        kind: 'worship',
        label: 'Temples and churches',
        places: [
          { name: 'Hindu temple, Köln-Kalk', lat: 50.9372, lon: 7.0098, distanceM: 6900 },
          { name: 'Malayalam Mass (Syro-Malabar)', lat: 50.9455, lon: 6.9302, distanceM: 1300 },
        ],
      },
      {
        kind: 'transport',
        label: 'Transport',
        places: [{ name: 'Köln-Ehrenfeld station', lat: 50.9516, lon: 6.9177, distanceM: 350 }],
      },
    ],
  };
  const budget: BudgetBlock = {
    id: 'budget_real',
    type: 'budget',
    title: 'Your month in Köln, real numbers',
    body: 'Your net pay is about €2,150. After these costs, about €900 is left.',
    city,
    lines: [
      { label: 'Rent, 1-room flat in Ehrenfeld', amount: 690, note: 'Warm rent, heating included' },
      { label: 'Food and household', amount: 300 },
      { label: 'Deutschlandticket', amount: 58 },
      { label: 'Phone and internet', amount: 35 },
      { label: 'Money home and other', amount: 170 },
    ],
    total: 1253,
    compare: [
      { city: 'Köln', total: 1253 },
      { city: 'Düsseldorf', total: 1310 },
      { city: 'Bonn', total: 1180 },
    ],
    sources: [
      { label: 'Mietspiegel Köln', url: 'https://www.stadt-koeln.de/leben-in-koeln/planen-bauen/mietspiegel' },
      { label: 'Deutschlandticket', url: 'https://www.deutschlandticket.de/' },
    ],
  };
  const payslip: BudgetBlock = {
    id: 'payslip',
    type: 'budget',
    title: 'Your first payslip, explained',
    body: 'Tax and social insurance come off before you are paid. Tax class I, no church tax.',
    city,
    lines: [
      { label: 'Gross pay (Bruttolohn)', amount: 3200, note: 'Pflegefachkraft in Anerkennung' },
      { label: 'Income tax (Lohnsteuer)', amount: -360, note: 'Comes back partly with a tax return' },
      { label: 'Health insurance (Krankenversicherung)', amount: -273.6, note: 'Covers doctors and hospital' },
      { label: 'Care insurance (Pflegeversicherung)', amount: -76.8 },
      { label: 'Pension (Rentenversicherung)', amount: -297.6, note: 'Counts towards a German pension' },
      { label: 'Unemployment (Arbeitslosenversicherung)', amount: -41.6 },
    ],
    total: 2150.4,
    compare: [],
    sources: [{ label: 'Federal Ministry of Finance: tax calculator', url: 'https://www.bmf-steuerrechner.de/' }],
  };
  return base(a, 'germany', `Willkommen in ${city}, Ananya. Your first two weeks, step by step.`, 'Questions at any hour: write here or on Discord. Your companion sees the same plan.', [
    {
      id: 'next_anmeldung',
      type: 'next_step',
      title: 'This week',
      body: 'Anmeldung at Bürgeramt Ehrenfeld. It unlocks your bank account and tax ID.',
      actions: [
        { label: 'What do I bring?', kind: 'chat', value: 'What do I bring to the Anmeldung?' },
        { label: 'Open the map', kind: 'link', value: '#places' },
      ],
      tags: ['web'],
    },
    arrival,
    places,
    budget,
    payslip,
    {
      id: 'companion',
      type: 'note',
      tone: 'success',
      title: 'Your integration companion',
      body: 'Jonas Weber from Educaro will call you this week. He has your brief and speaks English and German.',
    },
    timelineFromCalendar(a, 'Coming up', [
      { date: new Date(Date.now() + 5 * 86_400_000).toISOString(), label: 'Anmeldung, Bürgeramt Ehrenfeld', kind: 'task' },
      { date: new Date(Date.now() + 14 * 86_400_000).toISOString(), label: 'First day at Rheinblick', kind: 'event' },
    ]),
    {
      id: 'services_de',
      type: 'services',
      title: 'Educaro, in Germany',
      services: [
        { ...SERVICES.companion, why: 'Jonas Weber, assigned to you' },
        { ...SERVICES.workshop, why: 'German workplace habits, first Saturday of the month' },
        { ...SERVICES.german, why: 'B2 evening course for the adaptation period' },
      ],
    },
  ]);
}

// =====================================================================================
// Rohan
// =====================================================================================

export function composeRohan(a: MockApplicant): Screen {
  const rwth = a.shortlist.find((s) => s.id === 'sl_r_rwth');
  const rwthReady = rwth && rwth.status !== 'checking';
  const ieltsVerified = a.flags.ielts === 'verified';
  const apsBooked = a.flags.aps === 'booked';
  const sl = (programmeId: string) => a.shortlist.some((s) => s.id === `sl_r_${programmeId}` || s.title === programmeId);

  const nextStep: Block = apsBooked
    ? {
        id: 'next_pack',
        type: 'next_step',
        title: 'Your next step',
        body: 'APS is on its way. Meanwhile I am preparing your RWTH pack: motivation letter, Europass CV and the portal guide.',
        actions: [{ label: 'See the plan', kind: 'link', value: '/app/outcome' }],
        tags: ['ai'],
        service: { ...SERVICES.study, why: 'We review the pack with you before you submit' },
      }
    : {
        id: 'next_aps',
        type: 'next_step',
        title: 'Your next step',
        body: 'Book APS document verification. It takes about 3 to 4 weeks.',
        actions: [
          { label: 'Open APS India', kind: 'link', value: 'https://www.aps-india.de/' },
          { label: 'I have booked it', kind: 'chat', value: 'I have booked my APS appointment' },
        ],
        tags: ['web'],
        service: { ...SERVICES.study, why: 'We check your APS papers before you courier them' },
      };

  const headline = rwthReady
    ? ieltsVerified
      ? 'Rohan, your IELTS is proved. APS is the only thing between you and RWTH Aachen.'
      : 'Rohan, RWTH Aachen fits: your 1.9 beats their 2.5. Two gaps: APS and your IELTS report.'
    : 'Rohan, your 8.2 CGPA is 1.9 on the German scale. Start APS verification this week. Every application waits for it.';

  const opportunities: OpportunitiesBlock = {
    id: 'opportunities',
    type: 'opportunities',
    title: 'Programmes that fit you',
    body: 'Picked for machine learning, English teaching and your 1.9. Shortlist one and I will check every requirement.',
    items: [PROGRAMMES.rwth, PROGRAMMES.tum, PROGRAMMES.tud, PROGRAMMES.dresden].map((p) => ({
      id: p.id,
      title: p.title,
      subtitle: p.subtitle,
      url: p.url,
      kind: 'programme' as const,
      why: p.why,
      shortlisted: a.shortlist.some((s) => s.url === p.url),
    })),
  };
  void sl;

  const budget: BudgetBlock = {
    id: 'budget',
    type: 'budget',
    title: 'Your month as a student',
    body: 'The blocked account needs €11,904 for the first year (€992 a month). Aachen fits inside it; Munich does not.',
    city: 'Aachen',
    lines: [
      { label: 'Rent, room in a shared flat', amount: 430 },
      { label: 'Health insurance (students)', amount: 140 },
      { label: 'Food', amount: 250 },
      { label: 'Semester contribution', amount: 55, note: 'Includes the Deutschlandsemesterticket' },
      { label: 'Phone and internet', amount: 25 },
      { label: 'Other', amount: 100 },
    ],
    total: 1000,
    compare: [
      { city: 'Aachen', total: 1000 },
      { city: 'Darmstadt', total: 1130 },
      { city: 'Munich', total: 1390 },
    ],
    sources: [
      { label: 'Federal Foreign Office: blocked account', url: 'https://india.diplo.de/in-en/service/05-VisaEinreise/-/2584268' },
      { label: 'DAAD: cost of living', url: 'https://www.daad.de/en/study-and-research-in-germany/plan-your-studies/costs-of-education-and-living/' },
    ],
  };

  const route: Block = {
    id: 'route',
    type: 'route',
    title: 'Your route',
    body: "A Master's is the clear fit. The Opportunity Card is a backup once you have work experience.",
    primary: 'study',
    alternatives: ['chancenkarte'],
    reasons: a.profile.routeReasons,
    chancenkarte: {
      total: 4,
      needed: 6,
      lines: [
        { label: 'Age under 35', points: 2 },
        { label: 'English C1 (IELTS 7.0, once proved)', points: 1 },
        { label: 'Shortage occupation (IT)', points: 1 },
        { label: 'German A2 or better', points: 0 },
        { label: 'Two years of work experience', points: 0 },
      ],
    },
  };

  const timeline = timelineFromCalendar(a, 'Deadlines and dates', [
    ...(apsBooked ? [] : [{ date: new Date(Date.now() + 2 * 86_400_000).toISOString(), label: 'Book APS verification', kind: 'task' as const }]),
    { date: '2027-05-31T23:59:00+02:00', label: 'TUM deadline (winter intake)', kind: 'deadline' },
    { date: '2027-07-15T23:59:00+02:00', label: 'TU Darmstadt deadline (winter intake)', kind: 'deadline' },
  ]);

  const services: ServicesBlock = {
    id: 'services',
    type: 'services',
    title: 'Educaro can help with',
    services: [
      { ...SERVICES.study, why: 'Shortlist, application pack and portal guide' },
      { ...SERVICES.consultant, why: 'Booked: in two days, 16:30' },
      { ...SERVICES.german, why: 'Not needed for English-taught courses, but A1 makes daily life easier' },
    ],
  };

  const matrix = rwthReady ? matrixBlock(a, 'sl_r_rwth', 'Read from RWTH\'s own admission page and your papers. Every row links to its source.') : null;

  return base(a, 'planning', headline, "Munich rent is far above Aachen's. A budget comparison is one tap away.", [
    matrix,
    nextStep,
    rwthReady && gapBlock(a, 'Your plan', 'APS first, then the IELTS report, then the application pack.'),
    shortlistBlock(a, 'Your shortlist'),
    ...questionBlocks(a),
    !rwthReady && opportunities,
    route,
    budget,
    !rwthReady && gapBlock(a, 'Your plan', 'APS first, then the IELTS report, then the application pack.'),
    readinessBlock(a, 'Computed from your checks, not guessed by the model.'),
    timeline,
    rwthReady && opportunities,
    services,
    truthBlock(a),
    documentsBlock(a, 'Your files'),
  ]);
}

// =====================================================================================
// Fresh and pipeline extras
// =====================================================================================

export function composeFresh(a: MockApplicant): Screen {
  const first = a.profile.name.split(' ')[0];
  if (!a.files.length)
    return base(
      a,
      'onboarding',
      `Welcome, ${first}. Tell me your story: one short video and every document you have.`,
      'Files stay on Educaro\'s server. Nothing personal goes into web searches.',
      [],
    );
  const reading = a.files.some((f) => f.status === 'queued' || f.status === 'reading');
  if (reading)
    return base(a, 'onboarding', 'Reading your files. Your screen builds itself as I go.', 'Every file becomes a claim with a source.', [
      documentsBlock(a, 'Your files', 'Sorted on arrival. Phone photos are fine.'),
    ]);
  const routeSet = a.profile.route !== null;
  return base(
    a,
    routeSet ? 'planning' : 'onboarding',
    routeSet ? `${first}, here is your route and the first step.` : `Thanks, ${first}. I have read your files. One question before I pick your route.`,
    'Add more files any time. I re-check everything.',
    [
      ...questionBlocks(a),
      routeSet && {
        id: 'next_consult',
        type: 'next_step',
        title: 'Your next step',
        body: 'Book a 30-minute call with an Educaro consultant to confirm the plan.',
        actions: [{ label: 'Book a call', kind: 'service', value: SERVICES.consultant.url }],
        tags: ['ai'],
        service: SERVICES.consultant,
      },
      routeSet && {
        id: 'route',
        type: 'route',
        title: 'Your route',
        primary: a.profile.route!,
        alternatives: a.profile.routeAlternatives,
        reasons: a.profile.routeReasons,
      },
      a.truth.length > 0 && truthBlock(a),
      documentsBlock(a, 'Your files'),
      { id: 'note_more', type: 'note', tone: 'info', title: 'The more you add, the better the plan', body: 'Marksheets, experience letters and language certificates all help. Any order.' },
    ],
  );
}

export function composeExtra(a: MockApplicant): Screen {
  const first = a.profile.name.split(' ')[0];
  return base(a, a.profile.mode, `${first}, here is where you stand.`, 'Composed by the agent from your checks.', [
    { id: 'note_stage', type: 'note', tone: a.profile.stage === 'arrived' ? 'success' : 'info', title: 'Latest', body: a.profile.stageReason ?? '' },
    ...questionBlocks(a),
    a.truth.length > 0 && truthBlock(a),
    readinessBlock(a, 'Computed from your checks.'),
    a.files.length > 0 && documentsBlock(a),
  ]);
}

export function composeScreen(a: MockApplicant): Screen {
  switch (a.persona) {
    case 'ananya':
      return composeAnanya(a);
    case 'rohan':
      return composeRohan(a);
    case 'fresh':
      return composeFresh(a);
    default:
      return composeExtra(a);
  }
}
