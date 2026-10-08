import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { WebService } from '../web/web.service';
import { FactsService } from '../profile/facts.service';
import { StateService } from '../agent/state.service';
import { TraceService } from '../trace/trace.service';
import { MCP_TOOLS, type ToolDeps } from './tools';

/**
 * Our own MCP server.
 *
 * The agent's tools are published over the protocol rather than only called in-process, so the
 * reasoning and the capabilities come apart: our loop is one client, and a consultant's own
 * assistant can be another without being handed database access.
 *
 * Stateless transport — a session per request. There is no long-lived MCP conversation to keep
 * here, and a stateless server survives a restart mid-demo without a client having to reconnect.
 */
@Injectable()
export class McpService implements OnModuleInit {
  private readonly log = new Logger('MCP');
  private deps!: ToolDeps;

  constructor(
    private readonly web: WebService,
    private readonly facts: FactsService,
    private readonly state: StateService,
    private readonly trace: TraceService,
  ) {}

  onModuleInit() {
    this.deps = { web: this.web, facts: this.facts, state: this.state };
    this.log.log(`${MCP_TOOLS.length} tools published at /api/mcp`);
  }

  /** A fresh server per request: cheap to build, and nothing leaks between callers. */
  buildServer(): McpServer {
    const server = new McpServer({ name: 'educaro', version: '0.1.0' }, { capabilities: { tools: {} } });
    // The SDK's schema types are written against zod v3 and this workspace is on v4. The shapes
    // work at runtime; only the signature cannot express them, so the registration is loosened
    // here rather than every tool being declared against the older types.
    const register = server.registerTool.bind(server) as unknown as (name: string, config: unknown, cb: (args: any) => Promise<unknown>) => void;
    for (const tool of MCP_TOOLS) {
      register(
        tool.name,
        { title: tool.title, description: tool.description, inputSchema: tool.input },
        async (args: any) => {
          const started = Date.now();
          try {
            const result = await tool.run(args, this.deps);
            await this.trace.record('tool', `mcp:${tool.name}`, { ms: Date.now() - started }, { applicantId: args?.applicantId ?? null });
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
          } catch (e: any) {
            // A guard refusal is an answer, not a crash: the caller should see why it was refused.
            await this.trace.record('guard', `mcp:${tool.name}`, { error: String(e?.message ?? e) }, { applicantId: args?.applicantId ?? null });
            return { isError: true, content: [{ type: 'text' as const, text: String(e?.message ?? e) }] };
          }
        },
      );
    }
    return server;
  }

  async handle(req: Request, res: Response) {
    const server = this.buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  list() {
    return MCP_TOOLS.map((t) => ({ name: t.name, title: t.title, description: t.description, input: Object.keys(t.input) }));
  }
}
