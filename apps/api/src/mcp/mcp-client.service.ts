import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { TraceService } from '../trace/trace.service';
import { McpService } from './mcp.service';

/**
 * Our own harness, as an MCP client.
 *
 * The tools were published over MCP and then called in-process anyway, which made the server a
 * claim rather than a seam. If our own agent does not go through it, nothing proves the protocol
 * path works, the guards are only enforced on the route we happen to use, and the two
 * implementations drift until an outside client gets a different product.
 *
 * So the loop speaks the protocol. The transport is in-memory rather than HTTP — a linked pair of
 * streams, no socket, no port, no serialisation over a network — so it costs nothing while being
 * the same request a Claude Desktop or a consultant's own assistant would send.
 */
@Injectable()
export class McpClientService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('MCP client');
  private client: Client | null = null;
  private ready: Promise<void> | null = null;

  constructor(
    private readonly mcp: McpService,
    private readonly trace: TraceService,
  ) {}

  onModuleInit() {
    this.ready = this.connect().catch((e) => {
      this.log.error(`could not connect to our own MCP server: ${e?.message}`);
      this.client = null;
    });
  }

  private async connect() {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const server = this.mcp.buildServer();
    await server.connect(serverSide);
    const client = new Client({ name: 'educaro-harness', version: '0.1.0' });
    await client.connect(clientSide);
    this.client = client;
    const { tools } = await client.listTools();
    this.log.log(`harness connected over MCP, ${tools.length} tools available`);
  }

  async onModuleDestroy() {
    await this.client?.close().catch(() => undefined);
  }

  /**
   * Call a tool the way any client would, and unwrap the JSON it returns.
   *
   * `null` on failure rather than a throw: a tool refused by a guard is an answer, and a specialist
   * that cannot reach one should degrade like every other part of this system rather than take the
   * run down with it.
   */
  async call<T = unknown>(name: string, args: Record<string, unknown>, ctx?: { applicantId?: string | null; runId?: string | null }): Promise<T | null> {
    if (this.ready) await this.ready;
    if (!this.client) return null;
    try {
      const res: any = await this.client.callTool({ name, arguments: args });
      const text = res?.content?.find((c: any) => c.type === 'text')?.text;
      if (res?.isError) {
        await this.trace.record('guard', `mcp_refused:${name}`, { reason: String(text).slice(0, 200) }, { applicantId: ctx?.applicantId ?? null, runId: ctx?.runId ?? null });
        return null;
      }
      return text ? (JSON.parse(text) as T) : null;
    } catch (e: any) {
      this.log.warn(`${name} over MCP failed: ${e?.message}`);
      return null;
    }
  }

  get connected(): boolean {
    return Boolean(this.client);
  }
}
