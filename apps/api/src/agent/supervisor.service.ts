import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Route as RouteSchema, ROUTE_LABEL, type Route } from '@educaro/shared';
import { LlmService } from '../llm/llm.service';
import { SkillsService } from './skills.service';
import type { CheckReport } from './checks';
import type { AgentEvent } from './events.service';
import type { QuestionCandidate } from '../profile/truth-map';
import type { ApplicantState } from './state.service';
import { ROUTES, SPECIALIST_LABEL, type SpecialistName } from '../knowledge/routes';
import { MAX_OPEN_QUESTIONS } from './guards.service';
import { midSentence } from '../knowledge/normalize';
import { germanLevels } from './checks';
import { classifyIntent, REPLY_SYSTEM } from './intent';
import { describeWeather, fetchWeather } from '../web/weather';
import { targetCity } from './specialists/living';
import { TraceService } from '../trace/trace.service';

const LOOP_NAMES = ['route', 'exams', 'scout', 'jobs', 'recognition', 'visa', 'money', 'housing', 'life', 'factcheck'] as const;

export const Plan = z.object({
  summary: z.string(),
  route: z.object({ primary: RouteSchema, alternatives: z.array(RouteSchema), reasons: z.array(z.string()) }).nullable(),
  ask: z.array(z.string()),
  customQuestion: z.object({ prompt: z.string(), why: z.string(), options: z.array(z.string()), factKey: z.string().nullable() }).nullable(),
  specialists: z.array(z.enum(LOOP_NAMES)),
  outside: z.array(z.object({ action: z.enum(['draft_application', 'book_consultant', 'notify_applicant']), targetId: z.string().nullable(), note: z.string() })),
  reply: z.string().nullable(),
});
export type Plan = z.infer<typeof Plan>;

const SYSTEM = `You are the supervisor of Educaro's applicant agent. Educaro (Germany) helps Indians move to Germany
for study, Ausbildung, nursing, skilled jobs or the Opportunity Card, and sells its own services: German courses,
ÖSD exams at its own centre, Anerkennung (recognition) via educaro Akademie, a nursing program, an Ausbildung program,
study guidance, skilled worker placement and consultant calls.

Each time an event arrives you plan the next most useful moves for ONE applicant:
- route: set it only if none is set or the evidence clearly changed; else null.
- ask: pick at most the allowed number of question candidate ids (most important first). Only ask what no document answers.
- customQuestion: only if something essential is unknown and no candidate covers it; else null.
- specialists: which specialists to run now (they run in parallel). Run the ones whose answers changed or matter now.
- outside: drafting an application (targetId = shortlist id) or booking a consultant. Drafts always wait for a human.
- reply: if the applicant wrote a chat message, answer it in 1 to 4 warm, specific sentences using only the facts given
  (else null). Never promise outcomes. German terms keep their name with a short meaning.
  ALWAYS WRITE IN ENGLISH, whatever the applicant writes in and wherever they are. These applicants are learning
  German and are not fluent yet; answering them in German is the one thing that makes the plan unreadable to the
  person it belongs to. Keep the German word for a German thing (Anmeldung, Anerkennung, Bürgeramt) and explain it.
- summary: one sentence for the audit trail, saying what you decided and why.
Hard rules enforced in code anyway: max two open questions; required checks always run; nothing leaves without approval.`;

@Injectable()
export class SupervisorService {
  constructor(
    private readonly llm: LlmService,
    private readonly skills: SkillsService,
    private readonly trace: TraceService,
  ) {}

  async plan(state: ApplicantState, report: CheckReport, events: AgentEvent[], candidates: QuestionCandidate[], required: SpecialistName[], runId: string): Promise<{ plan: Plan; by: 'agent' | 'rules' | 'rules+reply' }> {
    const slots = Math.max(0, MAX_OPEN_QUESTIONS - state.questions.filter((q) => q.status === 'open').length);
    const route = state.applicant.route as Route | null;
    const skill = route ? await this.skills.load(ROUTES[route].skill) : '';
    const user = [
      `ALLOWED NEW QUESTIONS: ${slots}`,
      `REQUIRED SPECIALISTS (will run regardless): ${required.join(', ') || 'none'}`,
      summarizeState(state, report),
      `QUESTION CANDIDATES:\n${candidates.map((c) => `- ${c.id}: ${c.prompt}`).join('\n') || '- none'}`,
      `EVENTS SINCE LAST RUN:\n${events.map(describeEvent).join('\n')}`,
      skill ? `ROUTE SKILL (${ROUTES[route!].skill}):\n${skill.slice(0, 2500)}` : '',
    ].join('\n\n');
    const llmPlan = await this.llm.json({ task: 'supervisor', tier: 'quality', system: SYSTEM, user, schema: Plan, applicantId: state.applicant.id, runId, maxTokens: 2500 });
    if (llmPlan) {
      llmPlan.ask = llmPlan.ask.filter((id) => candidates.some((c) => c.id === id)).slice(0, slots);
      // The planning prompt is asked to decide moves, and its reply drifts to whatever it just
      // decided: "how much will my first month cost" came back about a date mismatch on a CV. The
      // focused call answers the question that was actually asked, so it wins whenever there is one.
      const focused = await this.replyTo(state, report, events, runId);
      if (focused) llmPlan.reply = focused;
      return { plan: llmPlan, by: 'agent' };
    }
    const plan = this.rulesPlan(state, report, events, candidates, required, slots);
    // The planning prompt is large and it is the first thing a rate limit takes away. A reply is
    // small, so ask for it on its own rather than handing the applicant the same canned sentence
    // for every question they ask — which is exactly what a reviewer saw.
    const reply = await this.replyTo(state, report, events, runId);
    if (reply) plan.reply = reply;
    return { plan, by: reply ? 'rules+reply' : 'rules' };
  }


  /**
   * One question, one focused call. Classified first in code, so an acknowledgement never reaches a
   * model and a real question is asked on its own instead of riding inside the planning prompt.
   */
  private async replyTo(state: ApplicantState, report: CheckReport, events: AgentEvent[], runId: string): Promise<string | null> {
    const chat = [...events].reverse().find((e) => e.type === 'chat' || e.type === 'discord');
    const text = String(chat?.detail?.text ?? '').trim();
    if (!text) return null;

    const intent = classifyIntent(text);
    if (intent.cannedReply) {
      await this.trace.record('plan', 'intent', { intent: intent.intent, answered: 'rules' }, { applicantId: state.applicant.id, runId });
      return intent.cannedReply;
    }

    const lang = germanLevels(state);
    const facts = state.facts
      .filter((f) => (f.tag === 'verified' || f.tag === 'said') && !f.key.startsWith('contact.') && f.key !== 'identity.passport')
      .slice(-18)
      .map((f) => `${f.label}: ${f.value} (${f.tag})`);
    const context = [
      `APPLICANT: ${state.applicant.name.split(' ')[0]}, route ${state.applicant.route ?? 'not decided'}, city ${state.applicant.targetCity ?? 'not decided'}, stage ${state.applicant.stage}`,
      `GERMAN: proven ${lang.proven ?? 'none'}, claimed ${lang.claimed ?? 'none'}, needed ${report.language.need ?? 'n/a'}`,
      `NEXT STEPS: ${report.gaps.slice(0, 4).map((g) => `${g.title} (${g.howLong}, ${g.cost})`).join('; ') || 'none open'}`,
      // The specialists already worked the numbers out. Without them here the model says "I do not
      // have the figures" about a budget that is sitting on the applicant's own screen.
      numbers(state),
      `THEIR FACTS:\n${facts.join('\n') || 'nothing on file yet'}`,
      intent.focus === 'process' ? 'They are asking how something works in Germany, not about their own file. Answer the mechanism, then tie it to their situation in one clause.' : '',
      intent.focus === 'weather' ? await this.weatherFor(state) : '',
      `QUESTION: ${text}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const reply = await this.llm.text({
      task: 'chat_reply',
      tier: 'cheap',
      system: REPLY_SYSTEM,
      user: context,
      applicantId: state.applicant.id,
      runId,
      maxTokens: 400,
    });
    await this.trace.record('plan', 'intent', { intent: intent.intent, answered: reply ? 'model' : 'none' }, { applicantId: state.applicant.id, runId });
    return reply?.trim() || null;
  }


  /** Live weather for the city they are heading to, plus the winter they have not met yet. */
  private async weatherFor(state: ApplicantState): Promise<string> {
    const city = targetCity(state);
    const w = await fetchWeather(city.name, city.lat, city.lon);
    return `WEATHER (live, use these exact numbers and do not invent any):
${describeWeather(w, state.applicant.homeCity)}`;
  }

  private rulesPlan(state: ApplicantState, report: CheckReport, events: AgentEvent[], candidates: QuestionCandidate[], required: SpecialistName[], slots: number): Plan {
    const chat = [...events].reverse().find((e) => e.type === 'chat' || e.type === 'discord' || e.type === 'email_reply');
    let reply: string | null = null;
    if (chat) {
      const text = String(chat.detail?.text ?? '').toLowerCase();
      const top = report.gaps[0];
      if (/why/.test(text) && top) reply = `${top.title}: ${top.what} It comes first because the other steps depend on it.`;
      else if (/cost|money|budget|rent|€|euro/.test(text) && state.outputs.money) reply = `In ${state.outputs.money.output.city} plan for about €${state.outputs.money.output.total} a month. The full budget is on your screen.`;
      else if (top) reply = `Thanks, noted. Your next step is still: ${midSentence(top.title)}. I've updated your screen.`;
      else reply = 'Thanks, noted. I have updated your screen.';
    }
    const routeOut = state.outputs.route?.output;
    return {
      summary: `Rules plan: ${slots ? `ask ${Math.min(slots, candidates.length)} question(s), ` : ''}run ${required.length} required specialist(s)`,
      route: !state.applicant.route && routeOut ? { primary: routeOut.primary, alternatives: routeOut.alternatives ?? [], reasons: routeOut.reasons ?? [] } : null,
      ask: candidates.slice(0, slots).map((c) => c.id),
      customQuestion: null,
      specialists: [],
      outside: [],
      reply,
    };
  }
}

function describeEvent(e: AgentEvent): string {
  const d = e.detail ?? {};
  switch (e.type) {
    case 'chat':
    case 'discord':
      return `- ${e.type} message: "${String(d.text ?? '').slice(0, 500)}"`;
    case 'answer':
      return `- answered "${String(d.prompt ?? '').slice(0, 160)}" with "${String(d.answer ?? '')}"`;
    case 'email_reply':
      return `- email reply (${String(d.kind ?? 'other')}): ${String(d.summary ?? '').slice(0, 300)}`;
    default:
      return `- ${e.type}${Object.keys(d).length ? ` ${JSON.stringify(d).slice(0, 160)}` : ''}`;
  }
}

export function summarizeState(state: ApplicantState, report: CheckReport): string {
  const a = state.applicant;
  const lines: string[] = [];
  lines.push(
    `APPLICANT: ${a.name.split(' ')[0]} · route: ${a.route ? ROUTE_LABEL[a.route as Route] : 'not set'}${a.routeAlternatives?.length ? ` (alternatives: ${a.routeAlternatives.join(', ')})` : ''} · stage: ${a.stage} · mode: ${a.mode}${a.submittedAt ? ' · submitted to Educaro' : ''}`,
  );
  lines.push(`FILES: ${state.files.map((f) => `${f.kindLabel ?? f.originalName} [${f.status}]`).join(', ') || 'none'}`);
  const facts = state.facts.filter((f) => !(f.data as any)?.sensitive && !f.key.startsWith('contact.') && !f.key.startsWith('official.'));
  lines.push(`FACTS:\n${facts.slice(-40).map((f) => `- ${f.label}: ${f.value} [${f.tag}, from ${f.sourceKind}]`).join('\n')}`);
  lines.push(`TRUTH MAP: ${report ? '' : ''}${state.truth.rows.filter((r) => r.status !== 'verified').map((r) => `${r.label}=${r.status}${r.note ? ` (${r.note})` : ''}`).join('; ') || 'all verified'}`);
  lines.push(`OPEN QUESTIONS: ${state.questions.filter((q) => q.status === 'open').map((q) => q.prompt).join(' | ') || 'none'}`);
  const answered = state.questions.filter((q) => q.status === 'answered').slice(-3);
  if (answered.length) lines.push(`RECENT ANSWERS: ${answered.map((q) => `"${q.prompt}" -> "${q.answer}"`).join(' | ')}`);
  lines.push(`CHECKS: ${report.checks.map((c) => `${c.label} ${c.status} (${c.detail})`).join('; ')}`);
  lines.push(`GAPS (with plans): ${report.gaps.map((g) => g.title).join('; ') || 'none'}`);
  lines.push(`READINESS: ${report.readiness.overall}% (${report.readiness.outcome})`);
  lines.push(`SHORTLIST: ${state.shortlist.map((s) => `${s.id}: ${s.title} [${s.status}, ${s.gapCount} gaps]`).join('; ') || 'none'}`);
  const outs = Object.entries(state.outputs).map(([k, v]) => `${SPECIALIST_LABEL[k as SpecialistName] ?? k} (${Math.round((Date.now() - +v.at) / 60000)} min ago)`);
  lines.push(`SPECIALISTS ALREADY RUN: ${outs.join(', ') || 'none'}`);
  lines.push(`PENDING APPROVALS: ${state.approvals.filter((x) => x.status === 'pending').map((x) => x.title).join('; ') || 'none'}`);
  return lines.join('\n');
}

/** The figures the specialists already computed, so a question about money gets the real answer. */
function numbers(state: ApplicantState): string {
  const out: string[] = [];
  const money = state.outputs.money?.output as any;
  if (money?.total) out.push(`Monthly budget in ${money.city}: about EUR ${money.total}${money.lines?.length ? ` (${money.lines.slice(0, 4).map((l: any) => `${l.label} ${l.amount}`).join(', ')})` : ''}`);
  const housing = state.outputs.housing?.output as any;
  if (housing?.wgRoom) out.push(`Rent in ${housing.city}: WG room about EUR ${housing.wgRoom}, studio about EUR ${housing.studio}`);
  const exams = state.outputs.exams?.output as any;
  if (exams?.steps?.length) out.push(`Language plan: ${exams.steps.map((x: any) => `${x.level} ${x.weeks ? `${x.weeks}w` : ''} ${x.costEur ? `EUR ${x.costEur}` : ''}`.trim()).join(' -> ')}`);
  const recognition = state.outputs.recognition?.output as any;
  if (recognition?.months) out.push(`Recognition: about ${recognition.months} months once the file is complete`);
  return out.length ? `FIGURES ALREADY WORKED OUT (use these, do not invent others):\n${out.join('\n')}` : '';
}
