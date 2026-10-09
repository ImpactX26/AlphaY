import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Job, JobsOptions, Queue, QueueEvents, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';

export type QueueName = 'ingest' | 'agent' | 'specialists' | 'outbound' | 'timers' | 'community';

/** BullMQ on Redis. Every event becomes a job; workers are registered by the services that own them. */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly log = new Logger('Queue');
  readonly redis = new IORedis(config.redisUrl, { maxRetriesPerRequest: null }).on('error', (err) => this.log.warn(`redis: ${err?.message ?? err}`));
  private readonly queues = new Map<QueueName, Queue>();
  private readonly events = new Map<QueueName, QueueEvents>();
  private readonly workers: Worker[] = [];

  /**
   * Every Redis connection gets an error listener, because the absence of one is fatal.
   *
   * ioredis is an EventEmitter and reconnects on its own; the `error` event it emits while doing
   * so has no listener by default, and Node's rule for that is to throw it process-wide. A Redis
   * blip was therefore able to take down every route, the websocket and the agent loop. Reconnection
   * is already ioredis's job — ours is only to not die while it happens.
   */
  private attach(c: IORedis): IORedis {
    c.on('error', (err) => this.log.warn(`redis: ${err?.message ?? err}`));
    return c;
  }

  private connection() {
    return this.attach(new IORedis(config.redisUrl, { maxRetriesPerRequest: null }));
  }

  queue(name: QueueName): Queue {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, {
        connection: this.connection(),
        defaultJobOptions: { removeOnComplete: 200, removeOnFail: 200, attempts: 1 },
      });
      this.queues.set(name, q);
    }
    return q;
  }

  queueEvents(name: QueueName): QueueEvents {
    let e = this.events.get(name);
    if (!e) {
      e = new QueueEvents(name, { connection: this.connection() });
      this.events.set(name, e);
    }
    return e;
  }

  add<T>(name: QueueName, jobName: string, data: T, opts: JobsOptions = {}) {
    return this.queue(name).add(jobName, data, opts);
  }

  /** Add a job and wait for its return value (used for parallel specialists). */
  async run<T, R>(name: QueueName, jobName: string, data: T, timeoutMs = 120_000): Promise<R> {
    const job = await this.add(name, jobName, data);
    return (await job.waitUntilFinished(this.queueEvents(name), timeoutMs)) as R;
  }

  process<T, R>(name: QueueName, handler: (job: Job<T>) => Promise<R>, concurrency = 1) {
    const w = new Worker<T, R>(name, handler, { connection: this.connection(), concurrency });
    w.on('failed', (job, err) => this.log.error(`${name}/${job?.name} failed: ${err?.message}`, err?.stack));
    this.workers.push(w);
    this.queueEvents(name);
    return w;
  }

  async onModuleDestroy() {
    await Promise.allSettled(this.workers.map((w) => w.close()));
    await Promise.allSettled([...this.queues.values()].map((q) => q.close()));
    await Promise.allSettled([...this.events.values()].map((e) => e.close()));
    this.redis.disconnect();
  }
}
