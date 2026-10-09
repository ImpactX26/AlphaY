import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { config } from '../config';
import { db, schema } from '../db/db';
import { TraceService } from '../trace/trace.service';

/**
 * One gateway for every model call.
 *
 * Cost rules, enforced here so no caller can forget them:
 *  - `cheap` tier goes to Groq (free). `quality` tier goes to OpenAI while under the budget cap.
 *  - Every response is cached by a hash of provider + model + prompt. A replay costs nothing.
 *  - OpenAI spend is summed from the trace table at boot and checked before every call.
 *  - No automatic retries that re-spend tokens. If no provider is available the call returns
 *    null and the caller uses its rule-based fallback, so the app works with zero keys.
 */
export type Tier = 'cheap' | 'quality';

interface BaseCall {
  task: string;
  tier: Tier;
  system: string;
  user: string;
  maxTokens?: number;
  applicantId?: string | null;
  runId?: string | null;
  noCache?: boolean;
}

export interface JsonCall<T> extends BaseCall {
  schema: z.ZodType<T>;
}

export interface ChatCall extends Omit<BaseCall, 'user'> {
  messages: { role: 'user' | 'assistant'; content: string }[];
}

interface Provider {
  name: 'openai' | 'groq' | 'local';
  client: OpenAI;
  model: string;
}

// USD per 1M tokens [input, output]. Unknown models are priced conservatively.
const PRICES: Record<string, [number, number]> = {
  'gpt-5-nano': [0.05, 0.4],
  'gpt-5-mini': [0.25, 2.0],
  'gpt-5': [1.25, 10],
  'gpt-4.1-nano': [0.1, 0.4],
  'gpt-4.1-mini': [0.4, 1.6],
  'gpt-4o-mini': [0.15, 0.6],
};

@Injectable()
export class LlmService implements OnModuleInit {
  private readonly log = new Logger('LLM');
  private openai: Provider | null = null;
  private groq: Provider | null = null;
  private local: Provider | null = null;
  private openaiSpent = 0;
  private groqCooldownUntil = 0;

  constructor(private readonly trace: TraceService) {
    // The SDK defaults to a ten minute timeout and two retries, so one slow call can block for half
    // an hour. The agent loop holds a per-applicant lock while it waits, which turned a slow model
    // into "the agent has stopped working" for that person, with nothing in the log to say why.
    // Retries are zero on purpose: a retry re-spends tokens, and every task here has a fallback.
    const opts = { timeout: 45_000, maxRetries: 0 };
    if (config.openaiKey) {
      this.openai = { name: 'openai', client: new OpenAI({ apiKey: config.openaiKey, ...opts }), model: config.openaiModel };
    }
    if (config.groqKey) {
      this.groq = {
        name: 'groq',
        client: new OpenAI({ apiKey: config.groqKey, baseURL: 'https://api.groq.com/openai/v1', ...opts }),
        model: config.groqModel,
      };
    }
    /**
     * A model on this machine, through Ollama or anything else speaking the OpenAI API.
     *
     * Every hosted free tier has a daily token budget, and a day of building spends it — twice in
     * this build the replies collapsed to canned text mid-demo because the quota was gone, which
     * looks exactly like a broken agent. A local model has no quota and no bill, so the hundreds of
     * calls that go into testing stop competing with the ones a reviewer will make.
     *
     * It is slower and smaller, so it is not the default when a hosted key is present; LOCAL_LLM_FIRST
     * puts it in front for exactly that reason.
     */
    if (config.localLlmModel) {
      this.local = {
        name: 'local',
        client: new OpenAI({ apiKey: 'ollama', baseURL: config.localLlmUrl, timeout: 180_000, maxRetries: 0 }),
        model: config.localLlmModel,
      };
    }
  }

  async onModuleInit() {
    // Restoring past spend must never stop the API from starting: if Postgres is not up yet the
    // counter begins at 0 and the spend cap still applies to this run. Crashing here took the
    // whole API down with a stack trace whenever the database was a moment behind.
    try {
      const [row] = await db
        .select({ total: sql<number>`coalesce(sum(${schema.traces.costUsd}), 0)` })
        .from(schema.traces)
        .where(and(eq(schema.traces.kind, 'llm'), sql`${schema.traces.detail}->>'provider' = 'openai'`));
      this.openaiSpent = Number(row?.total ?? 0);
    } catch (e) {
      this.openaiSpent = 0;
      this.log.warn(`could not read past OpenAI spend (${(e as Error).message}); starting this run at $0`);
    }
    this.log.log(
      `providers: groq=${!!this.groq} openai=${!!this.openai} | first=${config.llmProvider} | openai spent $${this.openaiSpent.toFixed(4)} of $${config.openaiBudgetUsd}`,
    );
  }

  status() {
    return {
      groq: !!this.groq,
      local: this.local ? this.local.model : null,
      openai: !!this.openai,
      openaiModel: config.openaiModel,
      groqModel: config.groqModel,
      openaiSpentUsd: Number(this.openaiSpent.toFixed(4)),
      openaiBudgetUsd: config.openaiBudgetUsd,
    };
  }

  get available(): boolean {
    return !!(this.groq || this.openai || this.local);
  }

  /**
   * Embeddings, when there is an OpenAI key and only then.
   *
   * Groq serves no embedding model, so this is the one capability with no free tier behind it —
   * which is exactly why retrieval must not depend on it. text-embedding-3-small costs about two
   * cents per million tokens, so indexing one applicant's five documents is a rounding error, but
   * the caller still has to work without it.
   *
   * 384 dimensions to match the column that is already in the schema.
   */
  async embed(texts: string[]): Promise<number[][] | null> {
    if (!this.openaiOk() || !texts.length) return null;
    try {
      const res = await this.openai!.client.embeddings.create({ model: 'text-embedding-3-small', input: texts.slice(0, 96), dimensions: 384 });
      // Embeddings are cheap but not free, and the spend cap is a hard rule rather than a target.
      const cost = ((res.usage?.total_tokens ?? 0) / 1_000_000) * 0.02;
      this.openaiSpent += cost;
      await this.trace.record('llm', 'embed', { chunks: texts.length, tokens: res.usage?.total_tokens ?? 0 }, { costUsd: cost });
      return res.data.map((d) => d.embedding as number[]);
    } catch (e: any) {
      this.log.warn(`embeddings unavailable: ${e?.message}`);
      return null;
    }
  }

  private openaiOk() {
    return !!this.openai && this.openaiSpent < config.openaiBudgetUsd;
  }
  private groqOk() {
    return !!this.groq && Date.now() > this.groqCooldownUntil;
  }
  private localOk() {
    return !!this.local;
  }

  private pick(tier: Tier): Provider[] {
    const order: Provider[] = [];
    const add = (p: Provider | null, ok: boolean) => {
      if (p && ok && !order.includes(p)) order.push(p);
    };
    // Local first when asked for, so testing never eats the quota a demo depends on.
    if (config.localLlmFirst) add(this.local, this.localOk());
    // A paid key in front of everything, when one is configured to be. The free tier's 8,000
    // tokens a minute is the thing that made every question collapse to the rules fallback under
    // load, and a key that is paid for and unused is the worse of the two failures.
    if (config.llmProvider === 'openai') add(this.openai, this.openaiOk());
    if (config.llmProvider === 'groq') add(this.groq, this.groqOk());
    if (tier === 'quality' && config.qualityProvider === 'openai') add(this.openai, this.openaiOk());
    add(this.groq, this.groqOk());
    // And always as the last resort: a model that is slow beats no model at all.
    add(this.local, this.localOk());
    add(this.openai, this.openaiOk());
    return order;
  }

  /** Structured output. Returns null when no provider can answer; callers must have a fallback. */
  async json<T>(call: JsonCall<T>): Promise<T | null> {
    const jsonSchema = toStrictSchema(call.schema);
    const raw = await this.complete(call, [{ role: 'user', content: call.user }], jsonSchema);
    if (raw == null) return null;
    try {
      const parsed = call.schema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
      this.log.warn(`${call.task}: schema mismatch ${parsed.error.message.slice(0, 300)}`);
    } catch {
      this.log.warn(`${call.task}: invalid JSON`);
    }
    return null;
  }

  async text(call: BaseCall): Promise<string | null> {
    return this.complete(call, [{ role: 'user', content: call.user }], null);
  }

  async chat(call: ChatCall): Promise<string | null> {
    return this.complete({ ...call, user: '' }, call.messages, null);
  }

  private async complete(
    call: BaseCall,
    messages: { role: 'user' | 'assistant'; content: string }[],
    jsonSchema: Record<string, unknown> | null,
  ): Promise<string | null> {
    const providers = this.pick(call.tier);
    if (!providers.length) return null;

    for (const p of providers) {
      const key = hash({ p: p.name, m: p.model, t: call.task, s: call.system, msg: messages, j: jsonSchema });
      if (!call.noCache) {
        const hit = await db.query.llmCache.findFirst({ where: eq(schema.llmCache.key, key) });
        if (hit) {
          await this.trace.record('llm', call.task, { provider: p.name, model: p.model, cached: true }, {
            applicantId: call.applicantId,
            runId: call.runId,
          });
          return hit.response as string;
        }
      }
      try {
        const started = Date.now();
        const res = await p.client.chat.completions.create(this.params(p, call, messages, jsonSchema));
        const content = res.choices[0]?.message?.content ?? '';
        const tin = res.usage?.prompt_tokens ?? 0;
        const tout = res.usage?.completion_tokens ?? 0;
        const cost = p.name === 'openai' ? priceOf(p.model, tin, tout) : 0;
        if (p.name === 'openai') this.openaiSpent += cost;
        await db
          .insert(schema.llmCache)
          .values({ key, provider: p.name, model: p.model, task: call.task, response: content, tokensIn: tin, tokensOut: tout, costUsd: cost })
          .onConflictDoNothing();
        await this.trace.record(
          'llm',
          call.task,
          { provider: p.name, model: p.model, tokensIn: tin, tokensOut: tout, ms: Date.now() - started },
          { applicantId: call.applicantId, runId: call.runId, costUsd: cost },
        );
        if (!content) continue;
        return content;
      } catch (e: any) {
        const status = e?.status ?? e?.response?.status;
        this.log.warn(`${call.task} via ${p.name} failed (${status}): ${String(e?.message ?? e).slice(0, 300)}`);
        if (p.name === 'groq' && status === 429) {
          const retryAfter = Number(e?.headers?.['retry-after'] ?? 20);
          this.groqCooldownUntil = Date.now() + Math.min(retryAfter, 120) * 1000;
        }
        // 400s cost nothing; move on to the next provider.
      }
    }
    return null;
  }

  private params(
    p: Provider,
    call: BaseCall,
    messages: { role: 'user' | 'assistant'; content: string }[],
    jsonSchema: Record<string, unknown> | null,
  ): OpenAI.Chat.ChatCompletionCreateParamsNonStreaming {
    const body: any = {
      model: p.model,
      messages: [{ role: 'system', content: call.system }, ...messages],
      max_completion_tokens: call.maxTokens ?? 2500,
    };
    if (jsonSchema) {
      body.response_format = {
        type: 'json_schema',
        json_schema: { name: call.task.replace(/[^a-zA-Z0-9_-]/g, '_'), schema: jsonSchema, strict: true },
      };
    }
    // Keep hidden reasoning short: it is billed as output.
    if (p.name === 'openai' && /^(gpt-5|o\d)/.test(p.model)) body.reasoning_effort = 'minimal';
    if (p.name === 'groq' && p.model.includes('gpt-oss')) body.reasoning_effort = 'low';
    return body;
  }
}

function hash(v: unknown): string {
  return createHash('sha256').update(JSON.stringify(v)).digest('hex');
}

function priceOf(model: string, tin: number, tout: number): number {
  const key = Object.keys(PRICES)
    .sort((a, b) => b.length - a.length)
    .find((k) => model.startsWith(k));
  const [i, o] = key ? PRICES[key] : [2, 8];
  return (tin * i + tout * o) / 1_000_000;
}

const DROP_KEYS = new Set(['$schema', 'minLength', 'maxLength', 'pattern', 'format', 'default', 'minimum', 'maximum', 'minItems', 'maxItems', 'exclusiveMinimum', 'exclusiveMaximum']);

/** OpenAI/Groq strict mode: every object closed, every property required, no unsupported keywords. */
export function toStrictSchema(s: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(s, { target: 'draft-7', unrepresentable: 'any' }) as Record<string, unknown>;
  const walk = (node: any): any => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const out: any = {};
    for (const [k, v] of Object.entries(node)) {
      if (DROP_KEYS.has(k)) continue;
      out[k] = walk(v);
    }
    if (out.type === 'object' && out.properties) {
      out.additionalProperties = false;
      out.required = Object.keys(out.properties);
    }
    return out;
  };
  return walk(js);
}
