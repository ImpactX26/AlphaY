import type { QuestionCandidate } from '../profile/truth-map';
import { bestFact, type ApplicantState } from './state.service';

/**
 * The next thing we genuinely do not know.
 *
 * The guards cap how much the agent may ask; this is the other end of the same idea. An applicant
 * should never open their plan and find nothing to do, so when nothing is outstanding we ask for
 * the first missing essential, in a fixed order, in code. "No source, no save" still applies: the
 * `factKey` means the ask guard drops the question the moment a document answers it.
 */
const ESSENTIALS: { key: string; when: (s: ApplicantState) => boolean; q: Omit<QuestionCandidate, 'priority'> }[] = [
  {
    key: 'education.highest',
    when: (s) => !bestFact(s, 'education.highest'),
    q: {
      id: 'essential:education',
      prompt: 'What did you study, and when did you finish?',
      why: 'Your qualification decides the route, so this is the first thing I need.',
      options: ['Nursing (GNM or B.Sc.)', 'Engineering or science degree', 'Class 12 only', 'Something else'],
      factKey: 'education.highest',
      actions: {},
    },
  },
  {
    key: 'experience.total',
    when: (s) => !s.facts.some((f) => f.key.startsWith('experience.')),
    q: {
      id: 'essential:experience',
      prompt: 'How long have you been working, and where?',
      why: 'Work experience changes which routes are open to you, and it counts towards the Opportunity Card.',
      options: ['Less than a year', '1 to 3 years', 'More than 3 years', 'Not working yet'],
      factKey: 'experience.total',
      actions: {},
    },
  },
  {
    key: 'language.german',
    when: (s) => !bestFact(s, 'language.german'),
    q: {
      id: 'essential:german',
      prompt: 'Have you started learning German?',
      why: 'German is usually the longest part of the plan, so the sooner I know, the better the timeline.',
      options: ['Not yet', 'A bit, no certificate', 'I have a certificate'],
      factKey: 'language.german',
      actions: {},
    },
  },
  {
    key: 'goal.city',
    when: (s) => !bestFact(s, 'goal.city') && !s.applicant.targetCity,
    q: {
      id: 'essential:city',
      prompt: 'Is there a city in Germany you want to be in?',
      why: 'Family or friends nearby make the first months much easier, and I can prefer employers there.',
      options: ['No preference', 'I have family somewhere', 'I know the city'],
      factKey: 'goal.city',
      actions: {},
    },
  },
  {
    key: 'identity.passport',
    when: (s) => !s.files.some((f) => f.kind === 'passport') && !bestFact(s, 'identity.passport'),
    q: {
      id: 'essential:passport',
      prompt: 'Do you have a passport that is valid for at least another year?',
      why: 'Every visa appointment needs it, and renewing one in India takes weeks.',
      options: ['Yes', 'It expires soon', 'I do not have one yet'],
      factKey: 'identity.passport',
      actions: {},
    },
  },
];

export function essentialQuestion(state: ApplicantState): QuestionCandidate | null {
  const asked = new Set(state.questions.map((q) => (q.meta as any)?.candidateId).filter(Boolean));
  const next = ESSENTIALS.find((e) => !asked.has(e.q.id) && e.when(state));
  return next ? { ...next.q, priority: 30 } : null;
}
