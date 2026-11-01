import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ConfigError, loadConfig } from './config';

async function bootstrap(): Promise<void> {
  const log = new Logger('notifier');
  let port: number;
  try {
    port = loadConfig().port;
  } catch (e) {
    if (e instanceof ConfigError) {
      log.error(`config error: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }

  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*', methods: ['GET'], allowedHeaders: ['Authorization'] });
  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
  log.log(`listening on :${port}`);
}

void bootstrap();
