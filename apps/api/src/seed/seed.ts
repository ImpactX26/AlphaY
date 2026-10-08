import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import PDFDocument from 'pdfkit';
import { AppModule } from '../app.module';
import { db, schema } from '../db/db';
import { DEMO_EMAILS, personaEmail } from '../auth/auth.controller';
import { StorageService } from '../storage/storage.service';
import { IngestService } from '../ingest/ingest.service';
import { AgentEventsService } from '../agent/events.service';
import { QueueService } from '../queue/queue.service';
import { ANANYA_DOCS, ANANYA_VIDEO_SCRIPT, ROHAN_DOCS, ROHAN_VIDEO_SCRIPT, type DemoDoc } from './documents';
import { OPENINGS, PROGRAMME_ROWS } from './catalogue';
import { seedCohort } from './cohort';
import { WebService } from '../web/web.service';

const log = new Logger('Seed');

function pdf(doc: DemoDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const d = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks: Buffer[] = [];
    d.on('data', (c: Buffer) => chunks.push(c));
    d.on('end', () => resolve(Buffer.concat(chunks)));
    d.on('error', reject);
    doc.build(d);
    d.end();
  });
}

async function user(email: string, name: string, role: 'applicant' | 'staff') {
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) return existing;
  const [u] = await db.insert(schema.users).values({ email, name, role, passwordHash: await bcrypt.hash('educaro', 8) }).returning();
  return u;
}

/**
 * Seeds the two demo personas with real generated papers, the programme catalogue and the employer
 * openings, then runs the files through the real ingest pipeline so the demo opens on a profile the
 * agent actually built — conflicts included.
 *
 * Idempotent: running it again rebuilds the personas from scratch and leaves everything else alone.
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const storage = app.get(StorageService);
  const ingest = app.get(IngestService);
  const events = app.get(AgentEventsService);
  const q = app.get(QueueService);

  // ---------------- catalogue ----------------
  for (const p of PROGRAMME_ROWS) {
    await db.insert(schema.programmes).values(p).onConflictDoUpdate({ target: schema.programmes.url, set: { data: p.data, title: p.title, city: p.city } });
  }
  log.log(`${PROGRAMME_ROWS.length} programmes in the catalogue`);

  const existingOpenings = await db.select().from(schema.openings);
  for (const o of OPENINGS) {
    if (existingOpenings.some((e) => e.employer === o.employer && e.title === o.title)) continue;
    const keywords = Array.from(new Set(`${o.title} ${o.description}`.toLowerCase().split(/[^a-zäöüß]+/).filter((w) => w.length > 4))).slice(0, 25);
    await db.insert(schema.openings).values({ ...o, keywords });
  }
  log.log(`${OPENINGS.length} employer openings`);

  // Every "fresh" demo login leaves a throwaway applicant behind, and they pile up in the staff
  // pipeline where they are the first thing anyone sees. Clear out the empty ones.
  const throwaway = await db.select().from(schema.users);
  let removed = 0;
  for (const u of throwaway.filter((x) => /^ananya\.[a-z0-9]+@demo\.educaro\.local$/.test(x.email))) {
    const a = await db.query.applicants.findFirst({ where: eq(schema.applicants.userId, u.id) });
    if (a) {
      const facts = await db.select().from(schema.facts).where(eq(schema.facts.applicantId, a.id));
      if (facts.length) continue; // somebody actually used this one: leave it
      await db.delete(schema.applicants).where(eq(schema.applicants.id, a.id));
    }
    await db.delete(schema.users).where(eq(schema.users.id, u.id));
    removed += 1;
  }
  if (removed) log.log(`removed ${removed} empty throwaway applicant(s)`);

  // Open each university page once now and let it land in the page cache. The agent still fetches
  // it for real during a run — the source log and the quote check are unchanged — but a rehearsal
  // on bad wifi reads from Postgres instead of waiting on a server in Aachen.
  const web = app.get(WebService);
  let warmed = 0;
  for (const p of PROGRAMME_ROWS) {
    const page = await web.fetchPage(p.url, { runId: 'seed_warm', applicantId: null }, { fresh: true }).catch(() => null);
    if (page) {
      warmed += 1;
      log.log(`  cached ${p.university}: ${page.text.length} chars`);
    } else log.warn(`  could not reach ${p.url} — the stand-in will be used`);
  }
  log.log(`${warmed}/${PROGRAMME_ROWS.length} university pages cached`);

  // ---------------- staff ----------------
  await user(DEMO_EMAILS.staff, 'Meera Pillai', 'staff');
  log.log('staff login ready: staff@demo.educaro.local');

  // ---------------- personas ----------------
  const personas = [
    { key: 'ananya' as const, name: 'Ananya Nair', subtitle: 'GNM nurse, 4 years', homeCity: 'Kochi', docs: ANANYA_DOCS, script: ANANYA_VIDEO_SCRIPT },
    { key: 'rohan' as const, name: 'Rohan Mehta', subtitle: 'B.Tech CS, 2 years', homeCity: 'Pune', docs: ROHAN_DOCS, script: ROHAN_VIDEO_SCRIPT },
  ];

  const fileIds: string[] = [];
  for (const p of personas) {
    const u = await user(DEMO_EMAILS[p.key], p.name, 'applicant');
    // Rebuild the applicant from scratch so a re-seed is clean (cascades wipe files, facts, screens).
    await db.delete(schema.applicants).where(eq(schema.applicants.userId, u.id));
    const [a] = await db
      .insert(schema.applicants)
      .values({ userId: u.id, name: p.name, email: personaEmail(p.key), subtitle: p.subtitle, homeCity: p.homeCity })
      .returning();

    for (const doc of p.docs) {
      const bytes = await pdf(doc);
      const path = await storage.save(a.id, doc.name, bytes);
      const [f] = await db
        .insert(schema.files)
        .values({ applicantId: a.id, originalName: doc.name, mime: 'application/pdf', size: bytes.length, storagePath: path })
        .returning();
      fileIds.push(f.id);
    }

    // The intro video arrives as a transcript: the same facts, without asking anyone to record a clip
    // before the demo. The live upload path (persona 'fresh') still does real Whisper transcription.
    const [v] = await db
      .insert(schema.files)
      .values({
        applicantId: a.id,
        originalName: `${p.key}-intro.mp4`,
        mime: 'video/mp4',
        size: p.script.length,
        storagePath: await storage.writeGenerated(a.id, `${p.key}-intro-script.txt`, p.script),
        kind: 'video',
        kindLabel: 'Intro video',
        status: 'queued',
        text: p.script,
        extracted: { provider: 'seed', segments: [], seeded: true },
      })
      .returning();
    fileIds.push(v.id);
    log.log(`${p.name}: ${p.docs.length} papers + intro, applicant ${a.id}`);
  }

  // ---------------- run the real pipeline over them ----------------
  log.log('reading the seeded papers through the ingest pipeline…');
  for (const id of fileIds) await ingest.process(id);

  const applicants = await db.select().from(schema.applicants);
  for (const a of applicants.filter((x) => personas.some((p) => p.name === x.name))) {
    await events.wake(a.id, { type: 'upload', detail: { seed: true } }, 0);
  }

  // Give the agent loop a moment to take the jobs before we close the context.
  await new Promise((r) => setTimeout(r, 12_000));
  const counts = await Promise.all(
    applicants.map(async (a) => `${a.name}: ${(await db.select().from(schema.facts).where(eq(schema.facts.applicantId, a.id))).length} facts`),
  );
  log.log(counts.join(' · '));

  await seedCohort(log);

  await q.redis.quit().catch(() => undefined);
  await app.close();
  log.log('seed done. Demo logins: ananya | rohan | staff | fresh (POST /api/auth/demo)');
  process.exit(0);
}

main().catch((e) => {
  log.error(e?.message ?? e, e?.stack);
  process.exit(1);
});
