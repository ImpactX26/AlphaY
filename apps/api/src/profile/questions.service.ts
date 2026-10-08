import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { QuestionDTO } from '@educaro/shared';
import { db, schema } from '../db/db';
import { GuardError, GuardsService } from '../agent/guards.service';
import { AgentEventsService } from '../agent/events.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TraceService } from '../trace/trace.service';
import { FactsService } from './facts.service';
import type { QuestionCandidate } from './truth-map';

type QuestionRow = typeof schema.questions.$inferSelect;

export function toQuestionDTO(q: QuestionRow): QuestionDTO {
  return {
    id: q.id,
    prompt: q.prompt,
    why: q.why,
    options: q.options,
    factKey: q.factKey,
    status: q.status,
    answer: q.answer,
    createdAt: q.createdAt.toISOString(),
  };
}

/** Questions that earn their place: two open at most, each says why, never one a document already answers. */
@Injectable()
export class QuestionsService {
  constructor(
    private readonly guards: GuardsService,
    private readonly facts: FactsService,
    private readonly events: AgentEventsService,
    private readonly rt: RealtimeGateway,
    private readonly trace: TraceService,
  ) {}

  /** How many questions are still waiting on the applicant right now. */
  async openCount(applicantId: string): Promise<number> {
    const rows = await db.query.questions.findMany({ where: eq(schema.questions.applicantId, applicantId) });
    return rows.filter((q) => q.status === 'open').length;
  }

  async ask(
    applicantId: string,
    q: Pick<QuestionCandidate, 'prompt' | 'why' | 'options' | 'factKey' | 'actions'> & { id?: string },
    ctx: { runId: string },
  ): Promise<QuestionRow | null> {
    try {
      await this.guards.assertCanAsk({ applicantId, runId: ctx.runId }, q.factKey, q.id ?? null);
    } catch (e) {
      if (e instanceof GuardError) return null;
      throw e;
    }
    const [row] = await db
      .insert(schema.questions)
      .values({ applicantId, prompt: q.prompt, why: q.why, options: q.options, factKey: q.factKey, meta: { candidateId: q.id, actions: q.actions } })
      .returning();
    await this.trace.record('tool', 'ask_user_question', { prompt: q.prompt, candidateId: q.id }, { applicantId, runId: ctx.runId });
    this.rt.toBoth(applicantId, { type: 'refresh', applicantId, what: ['questions'] });
    return row;
  }

  async answer(questionId: string, answer: string, channel: 'web' | 'email' | 'discord' = 'web'): Promise<QuestionRow> {
    const q = await db.query.questions.findFirst({ where: eq(schema.questions.id, questionId) });
    if (!q) throw new NotFoundException('Question not found');
    const [row] = await db
      .update(schema.questions)
      .set({ status: 'answered', answer: answer.slice(0, 2000), answeredAt: new Date() })
      .where(eq(schema.questions.id, questionId))
      .returning();
    await this.applyAction(row, answer);
    await this.events.wake(q.applicantId, { type: 'answer', detail: { questionId, prompt: q.prompt, answer, channel } });
    return row;
  }

  private async applyAction(q: QuestionRow, answer: string) {
    const action = q.meta?.actions?.[answer];
    const runId = `answer_${q.id.slice(0, 8)}`;
    if (!action) {
      if (answer.trim().length > 3) {
        await this.facts.save(
          q.applicantId,
          { key: `answer.${(q.factKey ?? 'note').replace(/^conflict:/, '')}`, label: 'Applicant explained', value: answer, tag: 'said', sourceKind: 'applicant', sourceRef: q.id },
          { runId },
        );
      }
      return;
    }
    if (action.startsWith('accept_document:')) {
      const keys = action.slice('accept_document:'.length).split('|');
      for (const key of keys) await this.facts.deactivate(q.applicantId, key, 'cv');
      await this.facts.save(
        q.applicantId,
        { key: 'cv.correction', label: 'CV correction', value: 'Use the experience letter dates in the CV', tag: 'said', sourceKind: 'applicant', sourceRef: q.id, data: { keys } },
        { runId },
      );
    } else if (action === 'name_same_person') {
      await this.facts.save(
        q.applicantId,
        { key: 'identity.same_person', label: 'Same person confirmed', value: 'Confirmed every spelling on the papers is the same person', tag: 'said', sourceKind: 'applicant', sourceRef: q.id },
        { runId },
      );
    } else if (action.startsWith('no_certificate:')) {
      const key = action.slice('no_certificate:'.length);
      await this.facts.save(
        q.applicantId,
        { key: `${key}.plan`, label: key.includes('german') ? 'German exam' : 'English test', value: 'Not taken yet: exam to be planned', tag: 'said', sourceKind: 'applicant', sourceRef: q.id },
        { runId },
      );
    }
  }
}
