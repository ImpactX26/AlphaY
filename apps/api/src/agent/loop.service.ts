import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, eq, notInArray } from 'drizzle-orm';
import type { PipelineStage, Route } from '@educaro/shared';
import { db, schema } from '../db/db';
import { QueueService } from '../queue/queue.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TraceService } from '../trace/trace.service';
import { ROUTES, type SpecialistName } from '../knowledge/routes';
import { QuestionsService } from '../profile/questions.service';
import { forwardOnly, runChecks, stageFor, type CheckReport } from './checks';
import { ComposerService } from './composer.service';
import { ShortlistService } from './shortlist.service';
import { essentialQuestion } from './essentials';
import { AgentEventsService, kLock, type AgentEvent } from './events.service';
import { SpecialistsService } from './specialists/specialists.service';
import { StateService, type ApplicantState } from './state.service';
import { SupervisorService, type Plan } from './supervisor.service';
import { ActionsService } from './actions.service';
import { ChatService } from '../profile/chat.service';

const newRunId = () => `run_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * The harness. Repeats after every event until nothing is open, or every gap has a plan the applicant has seen.
 *   wake → read state → supervisor plans → guard: required checks → act (ask, specialists in parallel, outside)
 *   → save with proof (inside each tool) → check requirements → gap plans → compose the screen → move the card
 */
@Injectable()
export class AgentLoopService implements OnModuleInit {
  private readonly log = new Logger('AgentLoop');

  constructor(
    private readonly q: QueueService,
    private readonly events: AgentEventsService,
    private readonly state: StateService,
    private readonly supervisor: SupervisorService,
    private readonly specialists: SpecialistsService,
    private readonly composer: ComposerService,
    private readonly shortlist: ShortlistService,
    private readonly questions: QuestionsService,
    private readonly actions: ActionsService,
    private readonly chat: ChatService,
    private readonly rt: RealtimeGateway,
    private readonly trace: TraceService,
  ) {}

  onModuleInit() {
    this.q.process<{ applicantId: string }, void>('agent', (job) => this.handle(job.data.applicantId), 4);
  }

  private async handle(applicantId: string) {
    const lock = await this.q.redis.set(kLock(applicantId), '1', 'PX', 180_000, 'NX');
    if (!lock) {
      await this.q.add('agent', 'loop', { applicantId }, { delay: 2500 });
      return;
    }
    try {
      await this.events.clearScheduled(applicantId);
      const events = await this.events.drain(applicantId);
      if (!events.length) return;
      await this.run(applicantId, events);
    } catch (e: any) {
      this.log.error(`loop ${applicantId} failed: ${e?.message}`, e?.stack);
      await this.trace.record('event', 'loop_error', { message: String(e?.message ?? e) }, { applicantId });
    } finally {
      await this.q.redis.del(kLock(applicantId));
      this.rt.toBoth(applicantId, { type: 'agent_status', applicantId, status: 'idle' });
      if (await this.events.pending(applicantId)) await this.events.schedule(applicantId, 300);
    }
  }

  async run(applicantId: string, events: AgentEvent[]) {
    const runId = newRunId();
    this.rt.toBoth(applicantId, { type: 'agent_status', applicantId, status: 'thinking', detail: 'Reading your profile' });
    await this.trace.record('event', 'wake', { events: events.map((e) => e.type) }, { applicantId, runId });
    let st = await this.state.load(applicantId);

    // Files still being read: a quick pass (truth map + screen data), no model calls. The last file triggers the full run.
    if (st.files.some((f) => f.status === 'queued' || f.status === 'reading')) {
      await this.composer.compose(st, runChecks(st), runId, false);
      return;
    }
    if (!st.files.some((f) => f.status === 'done') && !events.some((e) => e.type === 'chat')) {
      await this.composer.compose(st, runChecks(st), runId, false);
      return;
    }

    // Route first: the route specialist is code, so it is cheap to run before planning.
    if (!st.applicant.route && st.files.some((f) => f.status === 'done')) {
      await this.specialists.runParallel(['route'], applicantId, runId);
      st = await this.state.load(applicantId);
    }

    let report = runChecks(st);
    const required = this.requiredSpecialists(st, events);
    this.rt.toBoth(applicantId, { type: 'agent_status', applicantId, status: 'thinking', detail: 'Planning the next move' });
    const { plan, by } = await this.supervisor.plan(st, report, events, st.truth.candidates, required, runId);
    await this.trace.record('plan', 'supervisor', { by, summary: plan.summary, ask: plan.ask, specialists: plan.specialists, outside: plan.outside.map((o) => o.action), route: plan.route?.primary ?? null }, { applicantId, runId });

    // Guard 2: required checks cannot be skipped. The server sends the plan back with them added.
    const skipped = required.filter((r) => !plan.specialists.includes(r as any));
    if (skipped.length && by === 'agent') {
      await this.trace.record('guard', 'required_checks', { sentBack: true, added: skipped }, { applicantId, runId });
    }
    const toRun = [...new Set<SpecialistName>([...(plan.specialists as SpecialistName[]), ...required])];

    // Route
    if (plan.route && (!st.applicant.route || events.some((e) => e.type === 'route_set'))) await this.setRoute(st, plan.route, runId);
    else if (!st.applicant.route && st.outputs.route) await this.setRoute(st, { primary: st.outputs.route.output.primary, alternatives: st.outputs.route.output.alternatives ?? [], reasons: st.outputs.route.output.reasons ?? [] }, runId);

    // Ask (guarded inside)
    for (const id of plan.ask) {
      const c = st.truth.candidates.find((x) => x.id === id);
      if (c) await this.questions.ask(applicantId, c, { runId });
    }
    if (plan.customQuestion) {
      await this.questions.ask(applicantId, { ...plan.customQuestion, actions: {}, id: `custom:${plan.customQuestion.prompt.slice(0, 40)}` }, { runId });
    }

    // There is a cap of two open questions, but there was no floor, and a floor matters more.
    // Someone who has just uploaded a short intro has almost nothing to compare yet, so the truth
    // map offers no candidates and the supervisor plans no question — and they land on a screen
    // that asks them for nothing at all, which reads as the agent having given up on them. Ask for
    // the next thing we genuinely do not know, in code, so the conversation always has a next move.
    const open = await this.questions.openCount(applicantId);
    if (open === 0) {
      const essential = essentialQuestion(st);
      if (essential) await this.questions.ask(applicantId, essential, { runId });
    }

    // Reply first, so the applicant is not left waiting while specialists work.
    if (plan.reply) await this.chat.agentSays(applicantId, plan.reply, this.replyChannel(events));

    // Specialists, in parallel as queue jobs.
    if (toRun.length) {
      this.rt.toBoth(applicantId, { type: 'agent_status', applicantId, status: 'working', detail: `Running ${toRun.length} specialist${toRun.length > 1 ? 's' : ''}` });
      const results = await this.specialists.runParallel(toRun, applicantId, runId);
      await this.trace.record('event', 'specialists_done', { results }, { applicantId, runId });
    }

    // Act outside (drafts wait for approval).
    for (const o of plan.outside) await this.actions.run(applicantId, o, runId);

    // Any shortlist entry still 'checking' gets its requirement matrix built before the checks run.
    await this.shortlist.buildPending(applicantId, runId);

    // Check the requirements, plan every gap, compose, move the card.
    st = await this.state.load(applicantId);
    report = runChecks(st);
    await this.syncGaps(st, report, runId);
    st = await this.state.load(applicantId);
    this.rt.toBoth(applicantId, { type: 'agent_status', applicantId, status: 'working', detail: 'Writing your screen' });
    await this.composer.compose(st, report, runId, true);
    await this.moveCard(st, report, runId);
  }

  private replyChannel(events: AgentEvent[]): 'web' | 'email' | 'discord' {
    const last = [...events].reverse().find((e) => e.type === 'chat' || e.type === 'discord' || e.type === 'email_reply');
    return last?.type === 'discord' ? 'discord' : last?.type === 'email_reply' ? 'email' : 'web';
  }

  /** Required specialists for the route that have never run or are older than the newest fact. */
  requiredSpecialists(st: ApplicantState, events: AgentEvent[]): SpecialistName[] {
    const route = st.applicant.route as Route | null;
    if (!route) return ['route'];
    const newestFact = st.facts.reduce((m, f) => Math.max(m, +f.createdAt), 0);
    const spec = ROUTES[route];
    const base: SpecialistName[] = st.applicant.mode === 'germany' ? ['life', 'housing', 'money'] : spec.specialists.filter((s) => s !== 'route');
    const stale = base.filter((s) => !st.outputs[s] || +st.outputs[s].at < newestFact);
    if (events.some((e) => e.type === 'shortlist') && route === 'study' && !stale.includes('money')) stale.push('money');
    if (events.some((e) => e.type === 'recheck')) stale.push('factcheck');
    return [...new Set(stale)];
  }

  private async setRoute(st: ApplicantState, r: NonNullable<Plan['route']>, runId: string) {
    await this.state.touch(st.applicant.id, { route: r.primary, routeAlternatives: r.alternatives.filter((x) => x !== r.primary), routeReasons: r.reasons.slice(0, 4) });
    await this.trace.record('tool', 'set_goal', { route: r.primary, alternatives: r.alternatives }, { applicantId: st.applicant.id, runId });
  }

  /** run_gap_finder: upsert one row per gap (keeping status and "seen"), close gaps that are gone. */
  private async syncGaps(st: ApplicantState, report: CheckReport, runId: string) {
    const keys = report.gaps.map((g) => g.key);
    for (const g of report.gaps) {
      await db
        .insert(schema.gaps)
        .values({ applicantId: st.applicant.id, key: g.key, title: g.title, what: g.what, where: g.where, howLong: g.howLong, cost: g.cost, links: g.links, serviceId: g.serviceId, priority: g.priority, shortlistId: g.shortlistId ?? null })
        .onConflictDoUpdate({
          target: [schema.gaps.applicantId, schema.gaps.key],
          set: { title: g.title, what: g.what, where: g.where, howLong: g.howLong, cost: g.cost, links: g.links, serviceId: g.serviceId, priority: g.priority, status: 'planned' },
        });
    }
    await db
      .update(schema.gaps)
      .set({ status: 'done' })
      .where(keys.length ? and(eq(schema.gaps.applicantId, st.applicant.id), notInArray(schema.gaps.key, keys)) : eq(schema.gaps.applicantId, st.applicant.id));
    await this.trace.record('tool', 'run_gap_finder', { gaps: keys, readiness: report.readiness.overall }, { applicantId: st.applicant.id, runId });
  }

  private async moveCard(st: ApplicantState, report: CheckReport, runId: string) {
    const next = stageFor(st, report);
    const current = st.applicant.stage as PipelineStage;
    if (next.stage === current && next.reason === st.applicant.stageReason) return;
    if (!forwardOnly(current, next.stage)) return;
    await this.state.touch(st.applicant.id, { stage: next.stage, stageReason: next.reason });
    this.rt.toStaff({ type: 'pipeline', applicantId: st.applicant.id, stage: next.stage, reason: next.reason });
    await this.trace.record('move', 'pipeline', { from: current, to: next.stage, reason: next.reason }, { applicantId: st.applicant.id, runId });
  }
}
