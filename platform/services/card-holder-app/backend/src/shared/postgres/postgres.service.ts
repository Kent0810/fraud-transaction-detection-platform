import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

import type { Config } from '../../config';
import { CONFIG } from '../../config.module';

@Injectable()
export class PostgresService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger(PostgresService.name);
  readonly pool: Pool;

  constructor(@Inject(CONFIG) private readonly cfg: Config) {
    this.pool = new Pool({
      host: cfg.postgresHost,
      port: cfg.postgresPort,
      database: cfg.postgresDb,
      user: cfg.postgresUser,
      password: cfg.postgresPassword,
    });
  }

  async onModuleInit(): Promise<void> {
    this.log.log(`connecting to postgres ${this.cfg.postgresHost}:${this.cfg.postgresPort} (db ${this.cfg.postgresDb})`);
    await this.pool.query('SELECT 1');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
