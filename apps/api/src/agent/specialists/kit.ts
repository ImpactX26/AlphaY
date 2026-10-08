import type { LlmService } from '../../llm/llm.service';
import type { FactsService } from '../../profile/facts.service';
import type { TraceService } from '../../trace/trace.service';
import type { WebService } from '../../web/web.service';
import type { CheckReport } from '../checks';
import type { ApplicantState } from '../state.service';
import { OFFICIAL } from '../../knowledge/official';
import type { McpClientService } from '../../mcp/mcp-client.service';

export interface Kit {
  applicantId: string;
  runId: string;
  state: ApplicantState;
  report: CheckReport;
  web: WebService;
  llm: LlmService;
  facts: FactsService;
  trace: TraceService;
  /** The harness's own MCP client: tool calls go over the protocol, not around it. */
  mcp: McpClientService;
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
  // Both steps go through our own MCP server, which is also where the source guard lives: the page
  // has to have been opened in this run and the quote has to be on it, or save_fact refuses.
  const ctx = { runId: kit.runId, applicantId: kit.applicantId };
  const page = await kit.mcp.call<{ url: string; title: string; text: string }>('fetch_page', { url: o.url, applicantId: kit.applicantId, runId: kit.runId }, ctx);
  const saved = page
    ? await kit.mcp.call<{ saved: boolean; reason?: string }>(
        'save_fact',
        { applicantId: kit.applicantId, key: `official.${o.id}`, label: o.label, value: o.value, tag: 'web', sourceUrl: o.url, quote: o.quote, runId: kit.runId },
        ctx,
      )
    : null;
  if (saved?.saved) return { id: o.id, label: o.label, value: o.value, url: o.url, tag: 'web', confirmed: true };
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
