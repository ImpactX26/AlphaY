import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/db';

/**
 * The rest of the cohort.
 *
 * Three features only mean anything with other people in the system: who else is arriving in your
 * city that month, how long each step took the people ahead of you, and a thread with more than one
 * voice in it. Seeded with two personas they are all empty, and an empty version of each reads as
 * "not built" rather than "nobody here yet".
 *
 * These are files, not fixtures: real applicants at real stages, so the cohort maths runs over them
 * exactly as it would over a live caseload. First names and initials are all any of them ever shows
 * to anybody else.
 */

interface Peer {
  name: string;
  email: string;
  subtitle: string;
  homeCity: string;
  route: string;
  targetCity: string;
  stage: string;
  startDate: string;
  /** Weeks ago their file opened, so "how long did this take" has something real to measure. */
  weeksAgo: number;
}

const PEERS: Peer[] = [
  { name: 'Meenakshi Pillai', email: 'meenakshi@demo.educaro.local', subtitle: 'B.Sc. Nursing, 3 years', homeCity: 'Thrissur', route: 'nursing', targetCity: 'Cologne', stage: 'visa', startDate: '2027-03-01', weeksAgo: 34 },
  { name: 'Joseph Varghese', email: 'joseph@demo.educaro.local', subtitle: 'GNM nurse, 6 years', homeCity: 'Kottayam', route: 'nursing', targetCity: 'Cologne', stage: 'matched', startDate: '2027-09-01', weeksAgo: 22 },
  { name: 'Anjali Menon', email: 'anjali@demo.educaro.local', subtitle: 'GNM nurse, 2 years', homeCity: 'Kochi', route: 'ausbildung', targetCity: 'Aachen', stage: 'ready', startDate: '2027-10-01', weeksAgo: 15 },
  { name: 'Karthik Iyer', email: 'karthik@demo.educaro.local', subtitle: 'B.Tech ECE, CGPA 8.6', homeCity: 'Chennai', route: 'study', targetCity: 'Aachen', stage: 'applied', startDate: '2027-10-01', weeksAgo: 26 },
  { name: 'Priya Raghavan', email: 'priya@demo.educaro.local', subtitle: 'B.Tech IT, CGPA 7.9', homeCity: 'Coimbatore', route: 'study', targetCity: 'Darmstadt', stage: 'gap_plan', startDate: '2027-10-01', weeksAgo: 9 },
  { name: 'Nikhil Sharma', email: 'nikhil@demo.educaro.local', subtitle: 'B.Tech CS, CGPA 8.4', homeCity: 'Jaipur', route: 'study', targetCity: 'Munich', stage: 'arrived', startDate: '2026-10-01', weeksAgo: 48 },
];

/** Questions a cohort actually asks, and the kind of answer that only comes from someone who went. */
const THREAD: { author: string; text: string; replies: { author: string; kind: 'applicant' | 'agent'; text: string }[] }[] = [
  {
    author: 'Meenakshi',
    text: 'How long did the Anerkennung actually take for anyone here? The official page says three to four months and I have been waiting since June.',
    replies: [
      {
        author: 'Educaro agent',
        kind: 'agent',
        text: 'The three to four months is counted from the day your file is complete, not the day you sent it — a missing sworn translation restarts the clock quietly, so it is worth asking the office which document they are waiting on. If anyone here has been through it in NRW, please correct me.',
      },
      { author: 'Joseph', kind: 'applicant', text: 'Mine took five months in NRW. Four of those were them waiting for one translated transcript nobody told me was missing. Ask them every three weeks.' },
    ],
  },
  {
    author: 'Karthik',
    text: 'Is it worth paying for an expensive German course or is the Volkshochschule fine for B1?',
    replies: [
      {
        author: 'Educaro agent',
        kind: 'agent',
        text: 'For B1 the VHS is usually fine and much cheaper — what matters for the certificate is the exam, and Goethe, telc and ÖSD are all accepted whoever taught you. An intensive course is worth it when you have a date to hit, not because it is better German.',
      },
      { author: 'Nikhil', kind: 'applicant', text: 'VHS in Munich, 240 euros, passed B1 first time. The intensive one was 900. Same exam.' },
    ],
  },
  {
    author: 'Anjali',
    text: 'Did anyone find a room before arriving, or did you all come first and look after?',
    replies: [
      { author: 'Priya', kind: 'applicant', text: 'I applied to about forty WG adverts from India and got two replies. Came on a temporary room for six weeks, found the real one in person. Everyone I know did it that way.' },
    ],
  },
];

export async function seedCohort(log: { log: (m: string) => void }) {
  let made = 0;
  for (const p of PEERS) {
    const existing = await db.query.users.findFirst({ where: eq(schema.users.email, p.email) });
    const user =
      existing ??
      (await db.insert(schema.users).values({ email: p.email, name: p.name, role: 'applicant', passwordHash: await bcrypt.hash('educaro', 4) }).returning())[0];

    await db.delete(schema.applicants).where(eq(schema.applicants.userId, user.id));
    const opened = new Date(Date.now() - p.weeksAgo * 7 * 86_400_000);
    await db.insert(schema.applicants).values({
      userId: user.id,
      name: p.name,
      email: p.email,
      subtitle: p.subtitle,
      homeCity: p.homeCity,
      route: p.route,
      targetCity: p.targetCity,
      stage: p.stage,
      stageReason: 'Seeded cohort member',
      startDate: p.startDate,
      createdAt: opened,
      updatedAt: opened,
    });
    made += 1;
  }
  log.log(`${made} cohort members, so "people like you" and the arrival group have somebody in them`);

  // The thread, only if it is empty: re-seeding should not duplicate a conversation.
  const posts = await db.select().from(schema.communityPosts);
  if (!posts.length) {
    const applicants = await db.select().from(schema.applicants);
    const idOf = (first: string) => applicants.find((a) => a.name.split(' ')[0] === first)?.id ?? null;
    let when = Date.now() - 6 * 86_400_000;
    for (const t of THREAD) {
      when += 18 * 3_600_000;
      const [root] = await db
        .insert(schema.communityPosts)
        .values({ author: t.author, authorKind: 'applicant', applicantId: idOf(t.author), text: t.text, createdAt: new Date(when) })
        .returning();
      for (const r of t.replies) {
        when += 90 * 60_000;
        await db.insert(schema.communityPosts).values({
          parentId: root.id,
          author: r.author,
          authorKind: r.kind,
          applicantId: r.kind === 'agent' ? null : idOf(r.author),
          text: r.text,
          createdAt: new Date(when),
        });
      }
    }
    log.log(`${THREAD.length} cohort conversations, with the answers that only come from people who went`);
  }

  // One employer with a pattern, and one with a single report, so the "too few to rate" line is
  // visible next to a rating that has actually earned itself.
  const reports = await db.select().from(schema.employerReports);
  if (!reports.length) {
    const applicants = await db.select().from(schema.applicants);
    const by = (first: string) => applicants.find((a) => a.name.split(' ')[0] === first)?.id ?? null;
    await db.insert(schema.employerReports).values([
      { applicantId: by('Joseph'), employer: 'Seniorenzentrum Rheinbogen', category: 'hours', severity: 'serious', text: 'Rostered twelve days without a break and the overtime was never written down. The ward manager said it is normal for international staff.' },
      { applicantId: by('Meenakshi'), employer: 'Seniorenzentrum Rheinbogen', category: 'housing', severity: 'concern', text: 'The room they provide is deducted at 480 euros and the same flat is advertised at 350 on the street.' },
      { applicantId: by('Anjali'), employer: 'Seniorenzentrum Rheinbogen', category: 'respect', severity: 'concern', text: 'Asked to work through breaks and told the German staff would not be asked the same.' },
      { applicantId: by('Nikhil'), employer: 'Universitätsklinikum Aachen', category: 'documents', severity: 'note', text: 'Paperwork for the Anmeldung took three weeks longer than they said. Everything else has been correct.' },
    ]);
    log.log('4 private reports across 2 employers, so one rating is confident and one is honestly not');
  }
}
