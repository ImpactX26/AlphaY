import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { InterviewDTO } from '@educaro/shared';
import { db, schema } from '../db/db';
import { LlmService } from '../llm/llm.service';
import { TraceService } from '../trace/trace.service';
import { StateService } from './state.service';

const BANK: Record<InterviewDTO['kind'], string[]> = {
  visa: [
    'Why do you want to go to Germany and not another country?',
    'How will you pay for your first months in Germany?',
    'What will you do after your training or studies?',
    'Who is your employer or university, and what will you do there?',
    'Do you have family in Germany? Where?',
  ],
  employer: [
    'Tell us about yourself and your current work.',
    'Describe a difficult situation with a patient or customer and what you did.',
    'Why do you want to work with us in Germany?',
    'How are you learning German, and what level are you at?',
    'Where do you see yourself in two years?',
  ],
  university: [
    'Why this programme and this university?',
    'Which project from your bachelor’s are you most proud of, and why?',
    'How does this programme fit your career plan?',
    'How will you finance your studies?',
    'What do you know about studying in Germany?',
  ],
};

const Turn = z.object({ score: z.number(), feedback: z.string(), nextQuestion: z.string().nullable() });

/** Interview coach: mock visa, employer or university interviews, scored against the profile. */
@Injectable()
export class InterviewService {
  constructor(
    private readonly llm: LlmService,
    private readonly state: StateService,
    private readonly trace: TraceService,
  ) {}

  private dto(s: typeof schema.interviewSessions.$inferSelect): InterviewDTO {
    return { id: s.id, kind: s.kind, status: s.status, turns: s.turns };
  }

  async start(applicantId: string, kind: InterviewDTO['kind']): Promise<InterviewDTO> {
    const [s] = await db.insert(schema.interviewSessions).values({ applicantId, kind, turns: [{ role: 'coach', text: BANK[kind][0] }] }).returning();
    await this.trace.record('tool', 'interview_prep', { kind }, { applicantId });
    return this.dto(s);
  }

  async answer(sessionId: string, text: string): Promise<InterviewDTO> {
    const s = await db.query.interviewSessions.findFirst({ where: eq(schema.interviewSessions.id, sessionId) });
    if (!s) throw new NotFoundException();
    const st = await this.state.load(s.applicantId);
    const asked = s.turns.filter((t) => t.role === 'coach').length;
    const question = [...s.turns].reverse().find((t) => t.role === 'coach')?.text ?? '';
    const facts = st.facts
      .filter((f) => (f.tag === 'verified' || f.tag === 'said') && !(f.data as any)?.sensitive && !f.key.startsWith('contact.'))
      .slice(-25)
      .map((f) => `${f.label}: ${f.value}`)
      .join('\n');
    const res = await this.llm.json({
      task: 'interview_turn',
      tier: 'cheap',
      system: `You are a friendly but honest ${s.kind} interview coach for an Indian applicant moving to Germany. Score the answer 1-10 against their real profile (answers that contradict the profile score low). feedback: 2 short sentences, one strength, one fix. nextQuestion: the next realistic interview question, or null after 5 questions.`,
      user: `PROFILE:\n${facts}\n\nQUESTION: ${question}\nANSWER: ${text}\nQUESTIONS ASKED SO FAR: ${asked}`,
      schema: Turn,
      applicantId: s.applicantId,
      maxTokens: 900,
    });
    const words = text.trim().split(/\s+/).length;
    const turn = res ?? {
      score: Math.min(9, Math.max(3, Math.round(words / 12) + 3)),
      feedback: words < 25 ? 'Clear start. Add one concrete example from your own work or studies.' : 'Good detail. Keep it under a minute and end with why Germany.',
      nextQuestion: BANK[s.kind][asked] ?? null,
    };
    const turns = [...s.turns, { role: 'applicant' as const, text, score: turn.score, feedback: turn.feedback }];
    if (turn.nextQuestion && asked < 5) turns.push({ role: 'coach', text: turn.nextQuestion });
    const [row] = await db
      .update(schema.interviewSessions)
      .set({ turns, status: turn.nextQuestion && asked < 5 ? 'active' : 'done' })
      .where(eq(schema.interviewSessions.id, sessionId))
      .returning();
    return this.dto(row);
  }
}
