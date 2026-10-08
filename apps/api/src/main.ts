import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './config';

/**
 * Boots the API on `/api`. Owned by Claude B (see CLAUDE.md "Split inside apps/api").
 * The web app proxies /api and /socket.io here, so CORS only matters for direct calls.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: { origin: true, credentials: true } });
  app.setGlobalPrefix('api');
  // No ValidationPipe: bodies are checked in the controllers with zod (the shared contract's own
  // schemas) and plain guards, so the API needs no class-validator/class-transformer.
  await app.listen(config.port);
  new Logger('Bootstrap').log(`API on http://localhost:${config.port}/api`);
}

void bootstrap();
