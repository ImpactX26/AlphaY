import type { LlmService } from '../../llm/llm.service';
import type { FactsService } from '../../profile/facts.service';
import type { TraceService } from '../../trace/trace.service';
import type { WebService } from '../../web/web.service';
import type { CheckReport } from '../checks';
import type { ApplicantState } from '../state.service';
import { OFFICIAL } from '../../knowledge/official';

export interface Kit {
  applicantId: string;
  runId: string;
  state: ApplicantState;
  report: CheckReport;
  web: WebService;
  llm: LlmService;
  facts: FactsService;
  trace: TraceService;
  /** Strings that must never reach a search engine (name, phone, passport number). */
  personal: string[];
}

export interface SpecialistResult {
  summary: string;
  output: Record<string, unknown>;
}

export interface Cited {
  id: string;
  label: string;
  value: string;
  url: string;
  tag: 'web' | 'ai';
  confirmed: boolean;
}

/**
 * Open the official page, check the quote is still there, then save the value as a Web-sourced fact.
 * If the page changed or is unreachable, the value is kept but tagged AI-generated and flagged.
 */
export async function cite(kit: Kit, id: keyof typeof OFFICIAL | string): Promise<Cited | null> {
  const o = OFFICIAL[id];
  if (!o) return null;
  const page = await kit.web.fetchPage(o.url, { runId: kit.runId, applicantId: kit.applicantId });
  const saved = page
    ? await kit.facts.save(
        kit.applicantId,
        { key: `official.${o.id}`, label: o.label, value: o.value, tag: 'web', sourceKind: 'web', sourceUrl: o.url, quote: o.quote },
        { runId: kit.runId },
      )
    : null;
  if (saved) return { id: o.id, label: o.label, value: o.value, url: o.url, tag: 'web', confirmed: true };
  await kit.facts.save(
    kit.applicantId,
    { key: `official.${o.id}`, label: o.label, value: `${o.value} (could not confirm on the official page today)`, tag: 'ai', sourceKind: 'agent', sourceUrl: o.url },
    { runId: kit.runId },
  );
  return { id: o.id, label: o.label, value: o.value, url: o.url, tag: 'ai', confirmed: false };
}

export function firstName(name: string) {
  return name.split(/\s+/)[0];
}
