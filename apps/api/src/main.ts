import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: { origin: true, credentials: true } });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
  new Logger('Educaro').log(`API on http://localhost:${config.port}/api  ·  web ${config.webUrl}  ·  mail tracker ${config.mailpitUrl}`);
}

void bootstrap();
