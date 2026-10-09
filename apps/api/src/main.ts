import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: { origin: true, credentials: true } });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
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

process.on('uncaughtException', (err) => {
  log.error(`uncaught exception, staying up: ${err?.message ?? err}`, err?.stack);
});

process.on('unhandledRejection', (reason: any) => {
  log.error(`unhandled rejection, staying up: ${reason?.message ?? reason}`, reason?.stack);
});

void bootstrap();
