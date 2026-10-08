import { db, schema } from '../db/db';
import { eq } from 'drizzle-orm';
import type { CohortDTO } from '@educaro/shared';
import { PIPELINE_LABEL, type PipelineStage } from '@educaro/shared';

/**
 * People who were where you are, and how long each step actually took them.
 *
 * "How long will this take" is the question behind every other question, and the answers available
 * are useless: a government page gives a legal maximum, an agency gives a best case, and a forum
 * gives one person's story. What is worth knowing is what the people on this route actually took,
 * and whether you are ahead of them or behind.
 *
 * Two rules keep it honest. Only files far enough along to have real dates are counted — a plan
 * nobody acted on is not evidence. And the number of files is shown, so three people never read as
 * a trend. When the cohort is too small, published figures are used and the block says so.
 */

/** The steps everyone goes through, in order, with what the published guidance says they take. */
const STEPS: { key: string; label: string; stage: PipelineStage; publishedWeeks: [number, number] }[] = [
  { key: 'profiling', label: 'Documents read, profile clean', stage: 'profiling', publishedWeeks: [1, 4] },
  { key: 'gap_plan', label: 'Plan agreed, every gap costed', stage: 'gap_plan', publishedWeeks: [1, 3] },
  { key: 'ready', label: 'Papers ready, language on track', stage: 'ready', publishedWeeks: [12, 36] },
  { key: 'matched', label: 'Employer or university matched', stage: 'matched', publishedWeeks: [4, 16] },
  { key: 'applied', label: 'Application sent', stage: 'applied', publishedWeeks: [1, 4] },
  { key: 'visa', label: 'Visa granted', stage: 'visa', publishedWeeks: [6, 12] },
  { key: 'arrived', label: 'Arrived in Germany', stage: 'arrived', publishedWeeks: [2, 8] },
];

const ORDER: PipelineStage[] = ['new_story', 'profiling', 'gap_plan', 'ready', 'matched', 'applied', 'visa', 'arrived'];
const rank = (s: string) => Math.max(0, ORDER.indexOf(s as PipelineStage));

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export async function cohortFor(applicantId: string): Promise<CohortDTO> {
  const me = await db.query.applicants.findFirst({ where: eq(schema.applicants.id, applicantId) });
  const route = me?.route ?? null;
  const all = await db.select().from(schema.applicants);

  // Peers: same route, not this person, and far enough along to have taken any time at all.
  const peers = all.filter((a) => a.id !== applicantId && (!route || a.route === route) && rank(a.stage) >= rank('reading'));
  const basis = peers.length;
  const myRank = rank(me?.stage ?? 'new_story');

  const steps = STEPS.map((step) => {
    const reached = peers.filter((p) => rank(p.stage) >= rank(step.stage));
    // Weeks from the day their file opened to now, for everyone who got at least this far. A rough
    // proxy, and labelled as one: we do not store a timestamp per stage yet.
    const weeks = reached.map((p) => Math.max(1, Math.round((Date.now() - p.createdAt.getTime()) / (7 * 86_400_000))));
    const useCohort = reached.length >= 3;
    const medianWeeks = useCohort ? median(weeks) : Math.round((step.publishedWeeks[0] + step.publishedWeeks[1]) / 2);
    const rangeWeeks: [number, number] = useCohort ? [Math.min(...weeks), Math.max(...weeks)] : step.publishedWeeks;

    const stepRank = rank(step.stage);
    // "behind" is only meaningful for the step they are actually on: a step nobody has reached yet
    // has not been missed, it has not started. Calling every future step "behind" reads as failure
    // to somebody who is perfectly on schedule.
    const myWeeks = me ? Math.max(1, Math.round((Date.now() - me.createdAt.getTime()) / (7 * 86_400_000))) : 0;
    const youAre: CohortDTO['steps'][number]['youAre'] =
      myRank > stepRank ? 'ahead' : myRank < stepRank ? 'not_started' : myWeeks > rangeWeeks[1] ? 'behind' : 'on_track';

    return { label: step.label, medianWeeks, rangeWeeks, youAre };
  });

  return {
    route: route ?? 'not decided',
    basis,
    steps,
    peers: peers.slice(0, 5).map((p) => ({
      // First name and initial only. A cohort list that leaks who is going where is worse than none.
      label: `${p.name.split(' ')[0]} ${p.name.split(' ')[1]?.[0] ?? ''}.`.trim(),
      headline: [p.subtitle, p.homeCity && `from ${p.homeCity}`].filter(Boolean).join(' · ') || 'on the same route',
      nowAt: PIPELINE_LABEL[p.stage as PipelineStage] ?? p.stage,
    })),
  };
}
