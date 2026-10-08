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
  name: 'openai' | 'groq';
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
  private openaiSpent = 0;
  private groqCooldownUntil = 0;

  constructor(private readonly trace: TraceService) {
    if (config.openaiKey) {
      this.openai = { name: 'openai', client: new OpenAI({ apiKey: config.openaiKey }), model: config.openaiModel };
    }
    if (config.groqKey) {
      this.groq = {
        name: 'groq',
        client: new OpenAI({ apiKey: config.groqKey, baseURL: 'https://api.groq.com/openai/v1' }),
        model: config.groqModel,
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
      `providers: groq=${!!this.groq} openai=${!!this.openai} | openai spent $${this.openaiSpent.toFixed(4)} of $${config.openaiBudgetUsd}`,
    );
  }

  status() {
    return {
      groq: !!this.groq,
      openai: !!this.openai,
      openaiModel: config.openaiModel,
      groqModel: config.groqModel,
      openaiSpentUsd: Number(this.openaiSpent.toFixed(4)),
      openaiBudgetUsd: config.openaiBudgetUsd,
    };
  }

  get available(): boolean {
    return !!(this.groq || this.openai);
  }

  private openaiOk() {
    return !!this.openai && this.openaiSpent < config.openaiBudgetUsd;
  }
  private groqOk() {
    return !!this.groq && Date.now() > this.groqCooldownUntil;
  }

  private pick(tier: Tier): Provider[] {
    const order: Provider[] = [];
    const add = (p: Provider | null, ok: boolean) => {
      if (p && ok && !order.includes(p)) order.push(p);
    };
    if (tier === 'quality' && config.qualityProvider === 'openai') add(this.openai, this.openaiOk());
    add(this.groq, this.groqOk());
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
