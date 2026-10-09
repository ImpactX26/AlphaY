import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { config } from './config';

/**
 * Has the server actually bound its port?
 *
 * The safety net below must not apply before this is true. A process that cannot listen is not a
 * degraded server, it is not a server — and keeping it alive produced exactly that: an instance
 * with no HTTP, still signed in to Discord, posting as though it were the real one.
 */
let listening = false;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: { origin: true, credentials: true } });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
  listening = true;
  log.log(`API on http://localhost:${config.port}/api  ·  web ${config.webUrl}  ·  mail tracker ${config.mailpitUrl}`);
}

/**
 * The last resort, and a deliberate trade.
 *
 * Received wisdom is that a process should die on an uncaught exception, because its state is no
 * longer knowable. That is right for a service behind a supervisor that will restart it in a
 * second. This one is demonstrated live from a laptop, and the realistic causes here are a socket
 * somebody else closed — a dropped IMAP connection already took the whole API down once, taking
 * every route, the websocket and the agent loop with it.
 *
 * So: log it loudly enough that it is never mistaken for normal, and keep serving. Every known
 * emitter now has its own handler; this exists for the one nobody thought of.
 */
const log = new Logger('Educaro');

function survive(kind: string, err: any) {
  // Nothing is survivable before the port is bound. The first version of this net caught an
  // EADDRINUSE from a second instance and kept it running: no HTTP, but still holding a Discord
  // session and a database pool, which is worse than the crash it prevented.
  if (!listening) {
    log.error(`${kind} before the server was listening, exiting: ${err?.message ?? err}`, err?.stack);
    process.exit(1);
  }
  log.error(`${kind}, staying up: ${err?.message ?? err}`, err?.stack);
}

process.on('uncaughtException', (err) => survive('uncaught exception', err));
process.on('unhandledRejection', (reason: any) => survive('unhandled rejection', reason));

void bootstrap().catch((err) => {
  log.error(`failed to start: ${err?.message ?? err}`, err?.stack);
  process.exit(1);
});
