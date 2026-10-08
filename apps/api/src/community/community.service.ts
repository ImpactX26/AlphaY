import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { CommunityPostDTO } from '@educaro/shared';
import { db, schema } from '../db/db';
import { BusService } from '../common/bus.service';
import { LlmService } from '../llm/llm.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TraceService } from '../trace/trace.service';
import { classifyIntent } from '../agent/intent';

type Row = typeof schema.communityPosts.$inferSelect;

export const DEFAULT_CHANNEL = 'educaro-cohort';

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
  ) {}

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

    if (row.authorKind === 'applicant') void this.maybeAnswer(row).catch((e) => this.log.warn(`answer failed: ${e.message}`));
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
   * The agent answers a question in the open, once, for everyone.
   *
   * It stays out of anything that is not a question, and it says plainly that a person should
   * correct it — the cohort knows things no source page does, and an assistant that sounds final
   * stops people from contributing.
   */
  private async maybeAnswer(row: Row) {
    const intent = classifyIntent(row.text);
    if (!['plan_question', 'process_question', 'weather_question', 'unclear'].includes(intent.intent)) return;
    if (!/\?|^(how|what|when|where|which|who|why|can|does|is|are|do)\b/i.test(row.text.trim())) return;

    const answer = await this.llm.text({
      task: 'community_answer',
      tier: 'cheap',
      system: `You answer a question in a public group of Indian applicants moving to Germany. Answer in English, 2 to 4 sentences, concrete and practical.
Keep the German word for a German thing and explain it. Never invent a fee, a date or a requirement — if you are not sure, say what you would check.
This is a group, not a private file: never mention anyone's documents or personal details. End by inviting anyone who has done it to correct you.`,
      user: row.text,
      maxTokens: 320,
    });
    if (!answer) return;

    const [reply] = await db
      .insert(schema.communityPosts)
      .values({ channel: row.channel, parentId: row.id, author: 'Educaro agent', authorKind: 'agent', text: answer.trim() })
      .returning();
    this.bus.emit('community_post', { id: reply.id, channel: reply.channel, author: reply.author, text: reply.text, replyToDiscordId: row.discordMessageId ?? null });
    this.rt.toStaff({ type: 'refresh', applicantId: '', what: ['community'] });
  }

  /** Called by the Discord bridge when a message arrives in the cohort channel. */
  async fromDiscord(input: { discordMessageId: string; author: string; text: string; channel: string; applicantId: string | null }) {
    return this.post({ ...input, viaDiscord: true, authorKind: 'applicant' });
  }
}
