import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { CommunityPostDTO } from '@educaro/shared';
import { db, schema } from '../db/db';
import { BusService } from '../common/bus.service';
import { LlmService } from '../llm/llm.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TraceService } from '../trace/trace.service';
import { classifyIntent } from '../agent/intent';
import { QueueService } from '../queue/queue.service';
import { WebService } from '../web/web.service';

type Row = typeof schema.communityPosts.$inferSelect;

export const DEFAULT_CHANNEL = 'educaro-cohort';

/**
 * How long the cohort gets before the agent steps in.
 *
 * Long enough that a person in another timezone can realistically get there first, short enough
 * that a question asked at midnight is not still bare at breakfast. Configurable so a demo does not
 * have to wait it out.
 */
const GRACE_MS = Number(process.env.COMMUNITY_GRACE_MINUTES ?? 20) * 60_000;

/**
 * The cohort thread.
 *
 * Everyone on this journey is asking the same twelve questions six months apart, and answering each
 * one privately is both the most expensive way to run it and the loneliest way to go through it.
 * The thread is one place where the question is asked once, the agent answers from sources, and the
 * person who did it last year corrects the agent — which they do, and which is the point.
 *
 * It lives in the app and in Discord at the same time, because applicants already live in Discord
 * and will not open a second place to talk. `discordMessageId` is how the bridge stays honest: a
 * post that arrived from Discord is never sent back to Discord.
 */
@Injectable()
export class CommunityService {
  private readonly log = new Logger('Community');

  constructor(
    private readonly bus: BusService,
    private readonly llm: LlmService,
    private readonly rt: RealtimeGateway,
    private readonly trace: TraceService,
    private readonly q: QueueService,
    private readonly web: WebService,
  ) {
    this.startWorker();
  }

  private dto(row: Row, replies: Row[] = []): CommunityPostDTO {
    return {
      id: row.id,
      channel: row.channel,
      author: row.author,
      authorKind: row.authorKind,
      applicantId: row.applicantId,
      text: row.text,
      viaDiscord: row.viaDiscord,
      replies: replies.map((r) => this.dto(r)),
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(channel = DEFAULT_CHANNEL, limit = 50): Promise<CommunityPostDTO[]> {
    const all = await db.select().from(schema.communityPosts).where(eq(schema.communityPosts.channel, channel)).orderBy(desc(schema.communityPosts.createdAt)).limit(Math.min(300, limit * 4));
    const roots = all.filter((p) => !p.parentId).slice(0, limit);
    return roots.map((r) => this.dto(r, all.filter((p) => p.parentId === r.id).sort((a, b) => +a.createdAt - +b.createdAt)));
  }

  /** A post from the app. Mirrored to Discord, and answered by the agent when it is a question. */
  async post(input: { text: string; applicantId?: string | null; author?: string; authorKind?: Row['authorKind']; channel?: string; discordMessageId?: string; viaDiscord?: boolean }): Promise<CommunityPostDTO> {
    const text = input.text.trim();
    if (!text) throw new NotFoundException('Nothing to post');

    if (input.discordMessageId) {
      const seen = await db.query.communityPosts.findFirst({ where: eq(schema.communityPosts.discordMessageId, input.discordMessageId) });
      if (seen) return this.dto(seen);
    }

    let author = input.author;
    if (!author && input.applicantId) {
      const a = await db.query.applicants.findFirst({ where: eq(schema.applicants.id, input.applicantId) });
      // First name only. The thread is public to the cohort and nobody consented to a surname in it.
      author = a?.name.split(' ')[0] ?? 'Someone';
    }

    const [row] = await db
      .insert(schema.communityPosts)
      .values({
        channel: input.channel ?? DEFAULT_CHANNEL,
        applicantId: input.applicantId ?? null,
        author: author ?? 'Someone',
        authorKind: input.authorKind ?? 'applicant',
        text,
        discordMessageId: input.discordMessageId ?? null,
        viaDiscord: input.viaDiscord ?? false,
      })
      .returning();

    this.rt.toStaff({ type: 'refresh', applicantId: row.applicantId ?? '', what: ['community'] });
    if (row.applicantId) this.rt.toApplicant(row.applicantId, { type: 'refresh', applicantId: row.applicantId, what: ['community'] });

    // Only mirror outwards what did not come from there.
    if (!row.viaDiscord && row.authorKind !== 'agent') {
      this.bus.emit('community_post', { id: row.id, channel: row.channel, author: row.author, text: row.text });
    }
    await this.trace.record('event', 'community_post', { author: row.author, viaDiscord: row.viaDiscord }, { applicantId: row.applicantId });

    if (row.authorKind === 'applicant') await this.scheduleAnswer(row).catch((e) => this.log.warn(`schedule answer: ${e.message}`));
    return this.dto(row);
  }

  async reply(parentId: string, input: { text: string; applicantId?: string | null; author?: string; authorKind?: Row['authorKind'] }): Promise<CommunityPostDTO> {
    const parent = await db.query.communityPosts.findFirst({ where: eq(schema.communityPosts.id, parentId) });
    if (!parent) throw new NotFoundException('No such post');
    const child = await this.post({ ...input, channel: parent.channel });
    await db.update(schema.communityPosts).set({ parentId }).where(eq(schema.communityPosts.id, child.id));
    return { ...child, replies: [] };
  }

  /**
   * Give the cohort first refusal, then answer if nobody did.
   *
   * The bot used to reply the instant a question was posted, which quietly killed the thing the
   * thread exists for. Somebody who went through the Anerkennung in NRW last year knows things no
   * source page contains, and they will not type it underneath a confident answer that is already
   * there — so an assistant that is always first makes a community of one.
   *
   * So the agent waits. If a person answers in the meantime, it stays out of it entirely. If nobody
   * has after the grace period, it goes and does the reading rather than guessing: searching the
   * official sources, opening what it finds, and answering with the quote and the link. That is the
   * same rule the rest of the product follows — no source, no claim — and it is what makes the
   * answer worth correcting rather than worth ignoring.
   */
  private async scheduleAnswer(row: Row) {
    const intent = classifyIntent(row.text);
    if (!['plan_question', 'process_question', 'weather_question', 'places_question', 'unclear'].includes(intent.intent)) return;
    if (!/\?|^(how|what|when|where|which|who|why|can|does|is|are|do)\b/i.test(row.text.trim())) return;
    await this.q.add<{ postId: string }>('community', 'answer', { postId: row.id }, { delay: GRACE_MS, jobId: `answer:${row.id}` });
  }

  /** One worker for the delayed answers. Registered on construction, like every other queue here. */
  private startWorker() {
    this.q.process<{ postId: string }, void>('community', (job) => this.answerIfUnanswered(job.data.postId), 2);
  }

  /**
   * The grace period is up. Answer only if the cohort did not.
   *
   * Exposed so staff can say "answer it now" during a demo without waiting out the timer.
   */
  async answerIfUnanswered(postId: string, _opts: { force?: boolean } = {}) {
    const post = await db.query.communityPosts.findFirst({ where: eq(schema.communityPosts.id, postId) });
    if (!post) return;

    const replies = await db.select().from(schema.communityPosts).where(eq(schema.communityPosts.parentId, postId));
    // A person got there first. That is the better outcome and the agent should be glad of it.
    //
    // This holds even when staff press "answer now": `force` means "do not wait out the timer", not
    // "talk over the cohort". Letting it mean the second would make the button a way to bury the
    // one answer on the thread worth more than ours.
    if (replies.some((r) => r.authorKind !== 'agent')) {
      await this.trace.record('event', 'community_left_to_cohort', { postId, replies: replies.length }, { applicantId: post.applicantId });
      return;
    }
    if (replies.some((r) => r.authorKind === 'agent')) return;

    const research = await this.research(post.text);
    const answer = await this.llm.text({
      task: 'community_answer',
      tier: 'cheap',
      system: `You answer a question in a public group of Indian applicants moving to Germany, after nobody in the group answered it.
Answer in English, 2 to 4 sentences, concrete and practical. Keep the German word for a German thing and explain it.
Use ONLY the sources given below. Never invent a fee, a date or a requirement — if the sources do not settle it, say what you would check and where.
This is a group, not a private file: never mention anyone's documents or personal details.
End by inviting anyone who has actually done it to correct you.`,
      user: research.context ? `${research.context}

QUESTION: ${post.text}` : `No sources were reachable. Say what you would check and where.

QUESTION: ${post.text}`,
      maxTokens: 320,
    });

    const body = answer?.trim() || this.fallbackAnswer(research);
    if (!body) return;

    const text = research.sources.length
      ? `${body}\n\n${research.sources.map((s) => `· ${s.title} — ${s.url}`).join('\n')}`
      : body;

    const [reply] = await db
      .insert(schema.communityPosts)
      .values({ channel: post.channel, parentId: post.id, author: 'Educaro agent', authorKind: 'agent', text })
      .returning();
    this.bus.emit('community_post', { id: reply.id, channel: reply.channel, author: reply.author, text: reply.text, replyToDiscordId: post.discordMessageId ?? null });
    this.rt.toStaff({ type: 'refresh', applicantId: '', what: ['community'] });
    await this.trace.record('event', 'community_answered', { postId, sources: research.sources.length, byModel: Boolean(answer) }, { applicantId: post.applicantId });
  }

  /**
   * Go and read before answering.
   *
   * Searching and then opening what comes back is slower than generating from memory and is the
   * whole point: a wrong fee quoted confidently in a group of sixty people is repeated by all of
   * them. Failure here is fine — the answer then says what it would check instead of inventing it.
   */
  private async research(question: string): Promise<{ context: string; sources: { title: string; url: string }[] }> {
    const ctx = { runId: `community_${Date.now().toString(36)}` };
    const hits = await this.web.search(question, ctx).catch(() => []);
    const sources: { title: string; url: string }[] = [];
    const chunks: string[] = [];

    for (const hit of hits.slice(0, 3)) {
      const page = await this.web.fetchPage(hit.url, ctx).catch(() => null);
      if (!page?.text) continue;
      sources.push({ title: page.title || hit.title, url: hit.url });
      chunks.push(`SOURCE: ${page.title || hit.title} (${hit.url})
${page.text.slice(0, 2200)}`);
      if (chunks.length >= 2) break;
    }
    return { context: chunks.join('\n\n'), sources };
  }

  /** With no model and no sources, say so rather than producing a confident sentence from nothing. */
  private fallbackAnswer(research: { sources: { title: string; url: string }[] }): string {
    return research.sources.length
      ? `Nobody here has answered this yet, so I went and read the official pages linked below — they are the ones that settle it. If you have actually been through this, please correct me.`
      : `Nobody has answered this yet and I could not reach the official pages just now. Ask a consultant in the app and I will come back here with the answer and the link. If you have done it, please jump in.`;
  }

  /** Called by the Discord bridge when a message arrives in the cohort channel. */
  async fromDiscord(input: { discordMessageId: string; author: string; text: string; channel: string; applicantId: string | null }) {
    return this.post({ ...input, viaDiscord: true, authorKind: 'applicant' });
  }
}
