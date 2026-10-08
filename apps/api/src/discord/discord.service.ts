import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Guild,
  type Message,
  type TextChannel,
} from 'discord.js';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { db, schema } from '../db/db';
import { BusService } from '../common/bus.service';
import { ChatService } from '../profile/chat.service';
import { StateService } from '../agent/state.service';
import { runChecks } from '../agent/checks';
import { QueueService } from '../queue/queue.service';
import { TraceService } from '../trace/trace.service';
import { ROUTE_LABEL, type Route } from '@educaro/shared';
import { DISCORD_LINKS } from '../seed/catalogue';
import { CommunityService } from '../community/community.service';
import { ANNOUNCEMENTS } from '../community/announcements.service';

const COHORT = 'educaro-cohort';

/**
 * The cohort channel and the DM bot.
 *
 * Applicants live in Discord already, so the agent meets them there: ask it a question in a DM and
 * the answer is the same agent that writes the screen, with the same facts behind it. The cohort
 * channel carries the links everyone needs, posted once rather than retyped per person.
 *
 * With no DISCORD_TOKEN the whole thing stays dormant and nothing else notices.
 */
@Injectable()
export class DiscordService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Discord');
  private client: Client | null = null;
  private cohort: TextChannel | null = null;
  ready = false;

  constructor(
    private readonly bus: BusService,
    private readonly community: CommunityService,
    private readonly chat: ChatService,
    private readonly state: StateService,
    private readonly q: QueueService,
    private readonly trace: TraceService,
  ) {}

  async onModuleInit() {
    if (!config.discordToken) {
      this.log.log('no DISCORD_TOKEN: Discord is off');
      return;
    }
    // Message Content is a privileged intent and is off by default on a new bot. Slash commands
    // work without it; only free-text DMs need it. So try the full set, and if the gateway rejects
    // it, come back with the plain set rather than losing Discord altogether.
    this.client = this.build(true);

    this.client.once(Events.ClientReady, async (c) => {
      this.ready = true;
      this.log.log(`signed in as ${c.user.tag}${this.dmText ? '' : ' (free-text DMs off: enable Message Content in the Developer Portal)'}`);
      await this.registerCommands().catch((e) => this.log.warn(`commands: ${e.message}`));
      await this.ensureCohort().catch((e) => this.log.warn(`cohort channel: ${e.message}`));
      await this.postCohortLinks().catch(() => undefined);
    });
    this.client.on(Events.InteractionCreate, (i) => {
      if (i.isChatInputCommand()) void this.onCommand(i).catch((e) => this.log.error(e.message));
    });
    this.client.on(Events.MessageCreate, (m) => {
      if (m.author.bot) return;
      if (m.channel.type === ChannelType.DM) {
        void this.onDm(m.author.id, m.content, (t) => m.reply(t)).catch((e) => this.log.error(e.message));
        return;
      }
      // Anything typed in the cohort channel is a post in the thread, and shows in the app.
      if ((m.channel as TextChannel).name === COHORT && m.content.trim()) void this.onCohortMessage(m).catch((e) => this.log.error(e.message));
    });

    this.bus.on('agent_message', async (p) => {
      if (p.channel === 'discord') await this.dmApplicant(p.applicantId, p.text);
    });
    this.bus.on('notify', async (p) => {
      if (!p.channels || p.channels.includes('discord')) await this.dmApplicant(p.applicantId, `**${p.title}**\n${p.text}`);
    });
    this.bus.on('community_post', async (p) => {
      // The feed and the conversation live in different channels on purpose: put a wall of links
      // next to the thread and people mute both, and the thread is the part worth not muting.
      const ch = p.channel === ANNOUNCEMENTS ? await this.ensureChannel(ANNOUNCEMENTS, 'New programmes, jobs and deadlines in Germany') : await this.ensureCohort();
      if (!ch) return;
      // The bot is posting on someone's behalf, so the message says whose it is.
      const body = p.channel === ANNOUNCEMENTS ? p.text : `**${p.author}:** ${p.text}`;
      const sent = await ch.send(body.slice(0, 1900)).catch(() => null);
      if (sent) this.mirrored.add(sent.id);
    });

    try {
      await this.client.login(config.discordToken);
    } catch (e: any) {
      if (!/disallowed intents/i.test(String(e?.message))) {
        this.log.error(`login failed: ${e?.message}`);
        return;
      }
      this.log.warn('Message Content intent is off in the Developer Portal: slash commands only, no free-text DMs');
      this.dmText = false;
      await this.client.destroy().catch(() => undefined);
      this.client = this.build(false);
      this.wire();
      await this.client.login(config.discordToken).catch((err) => this.log.error(`login failed: ${err.message}`));
    }
  }

  private dmText = true;

  private build(withMessageContent: boolean): Client {
    const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages];
    if (withMessageContent) intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
    return new Client({ intents });
  }

  /** Re-attaches the handlers after a client is rebuilt with the reduced intent set. */
  private wire() {
    if (!this.client) return;
    this.client.once(Events.ClientReady, async (c) => {
      this.ready = true;
      this.log.log(`signed in as ${c.user.tag} (slash commands only)`);
      await this.registerCommands().catch((e) => this.log.warn(`commands: ${e.message}`));
      await this.ensureCohort().catch((e) => this.log.warn(`cohort channel: ${e.message}`));
      await this.postCohortLinks().catch(() => undefined);
    });
    this.client.on(Events.InteractionCreate, (i) => {
      if (i.isChatInputCommand()) void this.onCommand(i).catch((e) => this.log.error(e.message));
    });
  }

  async onModuleDestroy() {
    await this.client?.destroy().catch(() => undefined);
  }

  // ---------------- setup ----------------

  private async registerCommands() {
    // The application id has to match the token. Reading it off the signed-in client removes a
    // whole class of "not authorized to perform this action on this application" confusion.
    const appId = this.client?.application?.id ?? config.discordAppId;
    if (!config.discordToken || !appId) return;
    const commands = [
      new SlashCommandBuilder().setName('link').setDescription('Link this Discord account to your Educaro file').addStringOption((o) => o.setName('code').setDescription('The code from your Educaro app').setRequired(true)),
      new SlashCommandBuilder().setName('status').setDescription('Where you are, in one line'),
      new SlashCommandBuilder().setName('next').setDescription('Your next step and how long it takes'),
      new SlashCommandBuilder().setName('ask').setDescription('Ask the agent anything about your own file').addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true)),
      new SlashCommandBuilder().setName('links').setDescription('Post the cohort links (universities, APS, visa, courses)'),
    ].map((c) => c.toJSON());
    const rest = new REST().setToken(config.discordToken);
    // Guild commands appear instantly; global ones take up to an hour, so a guild id is worth
    // having. "Missing Access" means the bot was invited without the applications.commands scope.
    try {
      if (!config.discordGuildId) throw new Error('no guild id');
      await rest.put(Routes.applicationGuildCommands(appId, config.discordGuildId), { body: commands });
      this.log.log(`${commands.length} slash commands registered on the server`);
    } catch (e: any) {
      this.log.warn(`server commands failed (${e?.message}); registering globally instead — these can take up to an hour to appear`);
      this.log.warn(`to fix it instantly, re-invite the bot with both scopes: ${this.inviteUrl(appId)}`);
      await rest.put(Routes.applicationCommands(appId), { body: commands });
    }
  }

  /** Manage Channels + Send Messages + Embed Links + Read History, with the slash-command scope. */
  inviteUrl(appId = this.client?.application?.id ?? config.discordAppId): string {
    return `https://discord.com/api/oauth2/authorize?client_id=${appId}&permissions=76816&scope=bot%20applications.commands`;
  }

  private readonly channels = new Map<string, TextChannel>();

  /** Finds the channel or makes it. Cached, because a guild fetch per message is a rate limit. */
  private async ensureChannel(name: string, topic: string): Promise<TextChannel | null> {
    const cached = this.channels.get(name);
    if (cached) return cached;
    const guild: Guild | undefined = config.discordGuildId
      ? await this.client?.guilds.fetch(config.discordGuildId).catch(() => undefined)
      : this.client?.guilds.cache.first();
    if (!guild) return null;
    const existing = (await guild.channels.fetch()).find((c) => c?.name === name && c.type === ChannelType.GuildText) as TextChannel | undefined;
    const channel = existing ?? ((await guild.channels.create({ name, type: ChannelType.GuildText, topic })) as TextChannel);
    this.channels.set(name, channel);
    return channel;
  }

  private async ensureCohort(): Promise<TextChannel | null> {
    if (this.cohort) return this.cohort;
    this.cohort = await this.ensureChannel(COHORT, 'Educaro cohort: links, deadlines and answers from the agent');
    return this.cohort;
  }

  // ---------------- the cohort channel ----------------

  /** Posts the links everyone in the cohort needs. Idempotent enough to run on every boot. */
  async postCohortLinks(): Promise<number> {
    const ch = await this.ensureCohort();
    if (!ch) return 0;
    const recent = await ch.messages.fetch({ limit: 30 }).catch(() => null);
    if (recent?.some((m) => m.author.id === this.client?.user?.id && m.content.includes('Cohort links'))) return 0;
    const byTag = new Map<string, typeof DISCORD_LINKS>();
    for (const l of DISCORD_LINKS) byTag.set(l.tag, [...(byTag.get(l.tag) ?? []), l]);
    const body = [
      '**Cohort links** — the pages your plan actually cites. Each one is a source the agent opens and quotes.',
      ...[...byTag.entries()].map(([tag, links]) => `\n__${tag.toUpperCase()}__\n${links.map((l) => `· [${l.label}](${l.url})`).join('\n')}`),
      '\nAsk me anything about *your own* file with `/ask`, or just DM me. `/status` and `/next` are the short versions.',
    ].join('\n');
    await ch.send(body);
    await this.trace.record('tool', 'discord_post_links', { count: DISCORD_LINKS.length });
    return DISCORD_LINKS.length;
  }

  async announce(text: string) {
    const ch = await this.ensureCohort();
    await ch?.send(text);
  }


  /** Posts this bot wrote itself, so a mirrored message is never read back in as a new one. */
  private readonly mirrored = new Set<string>();

  private async onCohortMessage(m: Message) {
    if (this.mirrored.has(m.id)) return;
    const u = await db.query.users.findFirst({ where: eq(schema.users.discordUserId, m.author.id) });
    const applicant = u ? await db.query.applicants.findFirst({ where: eq(schema.applicants.userId, u.id) }) : null;
    await this.community.fromDiscord({
      discordMessageId: m.id,
      author: applicant?.name.split(' ')[0] ?? m.author.displayName ?? m.author.username,
      text: m.content.trim(),
      channel: COHORT,
      applicantId: applicant?.id ?? null,
    });
  }

  // ---------------- per-applicant ----------------

  private async applicantFor(discordUserId: string) {
    const u = await db.query.users.findFirst({ where: eq(schema.users.discordUserId, discordUserId) });
    if (!u) return null;
    return db.query.applicants.findFirst({ where: eq(schema.applicants.userId, u.id) });
  }

  async dmApplicant(applicantId: string, text: string) {
    if (!this.client) return;
    const a = await db.query.applicants.findFirst({ where: eq(schema.applicants.id, applicantId) });
    if (!a?.userId) return;
    const u = await db.query.users.findFirst({ where: eq(schema.users.id, a.userId) });
    if (!u?.discordUserId) return;
    const user = await this.client.users.fetch(u.discordUserId).catch(() => null);
    await user?.send(text.slice(0, 1900)).catch(() => undefined);
  }

  /**
   * Discord gives you three seconds to acknowledge an interaction or it tells the user "the
   * application did not respond" — even when the work afterwards succeeds. Redis, Postgres and a
   * model call are all on the other side of that budget, so every command defers first and edits
   * the reply when it has an answer. Anything that throws still gets a sentence back.
   */
  private async onCommand(i: ChatInputCommandInteraction) {
    await i.deferReply({ ephemeral: i.commandName !== 'ask' }).catch(() => undefined);
    try {
      await this.handle(i);
    } catch (e: any) {
      this.log.error(`/${i.commandName} failed: ${e?.message}`, e?.stack);
      await i.editReply('Something went wrong on my side. Try again in a moment.').catch(() => undefined);
    }
  }

  private async handle(i: ChatInputCommandInteraction) {
    if (i.commandName === 'links') {
      const n = await this.postCohortLinks();
      await i.editReply(n ? `Posted ${n} links in #${COHORT}.` : `The links are already up in #${COHORT}.`);
      return;
    }
    if (i.commandName === 'link') {
      const code = i.options.getString('code', true).trim().toUpperCase();
      const applicantId = await this.q.redis.get(`discord:link:${code}`);
      if (!applicantId) {
        await i.editReply('That code has expired, or it was already used. Open Educaro and tap "Connect Discord" for a new one.');
        return;
      }
      const a = await db.query.applicants.findFirst({ where: eq(schema.applicants.id, applicantId) });
      if (a?.userId) await db.update(schema.users).set({ discordUserId: i.user.id }).where(eq(schema.users.id, a.userId));
      await this.q.redis.del(`discord:link:${code}`);
      await this.trace.record('tool', 'discord_link', { discordUserId: i.user.id }, { applicantId });
      await i.editReply(`Linked to ${a?.name}'s file. Try \`/next\`, or just DM me a question.`);
      return;
    }

    const a = await this.applicantFor(i.user.id);
    if (!a) {
      await i.editReply('I do not know whose file this is yet. Open Educaro, tap "Connect Discord" and run `/link <code>`.');
      return;
    }

    if (i.commandName === 'status') {
      const st = await this.state.load(a.id);
      const r = runChecks(st);
      await i.editReply(
        [
          `**${a.name}** · ${a.route ? ROUTE_LABEL[a.route as Route] : 'route not decided'} · ${a.stage.replace(/_/g, ' ')}`,
          `Readiness **${r.readiness.overall}%** — ${r.readiness.meters.map((m) => `${m.label} ${m.value}%`).join(' · ')}`,
          `${st.gaps.filter((g) => g.status !== 'done').length} open steps, ${st.questions.filter((q) => q.status === 'open').length} questions waiting for you.`,
        ].join('\n'),
      );
      return;
    }
    if (i.commandName === 'next') {
      const st = await this.state.load(a.id);
      const r = runChecks(st);
      const g = r.gaps[0];
      await i.editReply(
        g
          ? `**${g.title}**\n${g.what}\nWhere: ${g.where}\nHow long: ${g.howLong} · Cost: ${g.cost}`
          : 'Nothing is blocking you right now. I will tell you the moment something needs you.',
      );
      return;
    }
    if (i.commandName === 'ask') {
      const question = i.options.getString('question', true);
      await this.chat.applicantSays(a.id, question, 'discord');
      await i.editReply(`*${question}*\n\nLet me look at your file — I will reply here in a moment.`);
      await this.waitForReply(a.id, (text) => i.followUp(text.slice(0, 1900)));
    }
  }

  private async onDm(discordUserId: string, text: string, reply: (t: string) => Promise<unknown>) {
    const a = await this.applicantFor(discordUserId);
    if (!a) {
      await reply('I do not know whose file this is yet. Open Educaro, tap "Connect Discord" and run `/link <code>` here.');
      return;
    }
    await this.chat.applicantSays(a.id, text, 'discord');
    await this.waitForReply(a.id, reply);
  }

  /** The agent answers on its own loop, so wait for the next agent message rather than blocking it. */
  private async waitForReply(applicantId: string, reply: (t: string) => Promise<unknown>) {
    const since = new Date();
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const rows = await db.query.chatMessages.findMany({ where: eq(schema.chatMessages.applicantId, applicantId) });
      const latest = rows.filter((m) => m.author === 'agent' && m.createdAt > since).sort((x, y) => +x.createdAt - +y.createdAt)[0];
      if (latest) {
        await reply(latest.text).catch(() => undefined);
        return;
      }
    }
    await reply('That one is taking me longer than usual — check your Educaro screen in a minute.').catch(() => undefined);
  }
}
