import { Injectable, OnModuleInit } from '@nestjs/common';
import { LlmService } from '../../llm/llm.service';
import { FactsService } from '../../profile/facts.service';
import { QueueService } from '../../queue/queue.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { TraceService } from '../../trace/trace.service';
import { WebService } from '../../web/web.service';
import type { SpecialistName } from '../../knowledge/routes';
import { runChecks } from '../checks';
import { StateService, type ApplicantState } from '../state.service';
import type { Kit, SpecialistResult } from './kit';
import { routeSpecialist } from './route';
import { examsSpecialist, recognitionSpecialist, visaSpecialist } from './papers';
import { housingSpecialist, lifeSpecialist, moneySpecialist } from './living';
import { safetySpecialist } from './safety';
import { factcheckSpecialist, jobsSpecialist, scoutSpecialist } from './matching';

type Fn = (kit: Kit) => Promise<SpecialistResult>;

/** Specialists that run inside the loop. The writer and interview coach are driven by explicit actions instead. */
export const LOOP_SPECIALISTS: Partial<Record<SpecialistName, Fn>> = {
  route: routeSpecialist,
  exams: examsSpecialist,
  scout: scoutSpecialist,
  jobs: jobsSpecialist,
  recognition: recognitionSpecialist,
  visa: visaSpecialist,
  money: moneySpecialist,
  housing: housingSpecialist,
  life: lifeSpecialist,
  factcheck: factcheckSpecialist,
  safety: safetySpecialist,
};

export function personalStrings(state: ApplicantState): string[] {
  const out = [state.applicant.name, state.applicant.email ?? ''];
  for (const f of state.facts) {
    if (['identity.name', 'contact.phone', 'contact.email', 'identity.dob'].includes(f.key)) out.push(f.value);
    const num = (f.data as any)?.number;
    if (num) out.push(String(num));
  }
  return out.filter((s) => s && s.length >= 4);
}

@Injectable()
export class SpecialistsService implements OnModuleInit {
  constructor(
    private readonly q: QueueService,
    private readonly state: StateService,
    private readonly web: WebService,
    private readonly llm: LlmService,
    private readonly facts: FactsService,
    private readonly trace: TraceService,
    private readonly mcp: McpClientService,
  ) {}

  onModuleInit() {
    this.q.process<{ applicantId: string; runId: string }, { name: string; summary: string }>(
      'specialists',
      (job) => this.runOne(job.name as SpecialistName, job.data.applicantId, job.data.runId),
      6,
    );
  }

  async runOne(name: SpecialistName, applicantId: string, runId: string): Promise<{ name: string; summary: string }> {
    const fn = LOOP_SPECIALISTS[name];
    if (!fn) return { name, summary: 'not a loop specialist' };
    const st = await this.state.load(applicantId);
    const kit: Kit = {
      applicantId,
      runId,
      state: st,
      report: runChecks(st),
      web: this.web,
      llm: this.llm,
      facts: this.facts,
      trace: this.trace,
      personal: personalStrings(st),
      mcp: this.mcp,
    };
    const started = Date.now();
    const res = await fn(kit);
    await this.state.saveOutput(applicantId, name, runId, res.output);
    await this.trace.record('tool', `run_specialist:${name}`, { summary: res.summary, ms: Date.now() - started }, { applicantId, runId });
    return { name, summary: res.summary };
  }

  /** Twelve in parallel as queue jobs (the loop waits for all of them). */
  async runParallel(names: SpecialistName[], applicantId: string, runId: string) {
    return Promise.all(
      names.map((n) =>
        this.q
          .run<{ applicantId: string; runId: string }, { name: string; summary: string }>('specialists', n, { applicantId, runId }, 120_000)
          .catch((e) => ({ name: n, summary: `failed: ${e?.message ?? e}` })),
      ),
    );
  }
}
