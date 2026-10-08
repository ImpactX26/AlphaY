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
- summary: one sentence for the audit trail, saying what you decided and why.
Hard rules enforced in code anyway: max two open questions; required checks always run; nothing leaves without approval.`;

@Injectable()
export class SupervisorService {
  constructor(
    private readonly llm: LlmService,
    private readonly skills: SkillsService,
  ) {}

  async plan(state: ApplicantState, report: CheckReport, events: AgentEvent[], candidates: QuestionCandidate[], required: SpecialistName[], runId: string): Promise<{ plan: Plan; by: 'agent' | 'rules' }> {
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
      return { plan: llmPlan, by: 'agent' };
    }
    return { plan: this.rulesPlan(state, report, events, candidates, required, slots), by: 'rules' };
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
