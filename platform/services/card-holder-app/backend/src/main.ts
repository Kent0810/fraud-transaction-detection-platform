/**
 * Cardholder API. Read-only over Cassandra: history, alerts and card state.
 * Budgets, merchant rules and transfers aren't here yet (they belong in Postgres / a payments
 * service), so the mobile app keeps those mocked.
 */
import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ConfigError, loadConfig } from './config';

async function bootstrap(): Promise<void> {
  const log = new Logger('cardholder-backend');
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
  // Dev only: the Expo web build runs on another port, so allow any origin.
  app.enableCors({ origin: '*', methods: ['GET'] });
  // SIGTERM from `docker compose stop`: close the Cassandra client cleanly.
  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
  log.log(`listening on :${port}`);
}

void bootstrap();
