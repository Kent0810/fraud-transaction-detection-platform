import { Inject, Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@platform/db';

import type { Config } from '../../config';
import { CONFIG } from '../../config.module';

@Injectable()
export class PrismaService implements OnModuleInit, OnApplicationShutdown {
  readonly client: PrismaClient;

  constructor(@Inject(CONFIG) cfg: Config) {
    this.client = createPrismaClient({
      host: cfg.postgresHost,
      port: cfg.postgresPort,
      database: cfg.postgresDb,
      user: cfg.postgresUser,
      password: cfg.postgresPassword,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect();
  }
}
