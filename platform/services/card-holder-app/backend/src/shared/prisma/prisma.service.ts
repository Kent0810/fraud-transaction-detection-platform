import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@platform/db';

import type { Config } from '../../config';
import { CONFIG } from '../../config.module';

@Injectable()
export class PrismaService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger(PrismaService.name);
  readonly client: PrismaClient;

  constructor(@Inject(CONFIG) private readonly cfg: Config) {
    this.client = createPrismaClient({
      host: cfg.postgresHost,
      port: cfg.postgresPort,
      database: cfg.postgresDb,
      user: cfg.postgresUser,
      password: cfg.postgresPassword,
    });
  }

  async onModuleInit(): Promise<void> {
    this.log.log(
      `connecting to postgres ${this.cfg.postgresHost}:${this.cfg.postgresPort} (db ${this.cfg.postgresDb})`,
    );
    await this.client.$connect();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect();
  }
}
