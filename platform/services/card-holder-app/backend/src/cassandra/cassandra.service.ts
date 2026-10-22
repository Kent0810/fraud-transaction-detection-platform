import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Client } from 'cassandra-driver';

import type { Config } from '../config';
import { CONFIG } from './cassandra.module.tokens';

export function createClient(cfg: Config): Client {
  return new Client({
    contactPoints: cfg.contactPoints,
    protocolOptions: { port: cfg.cassandraPort },
    localDataCenter: cfg.localDc,
    keyspace: cfg.keyspace,
  });
}

// One driver client for the whole app: it pools connections and caches prepared statements.
@Injectable()
export class CassandraService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger(CassandraService.name);
  readonly client: Client;

  constructor(@Inject(CONFIG) private readonly cfg: Config) {
    this.client = createClient(cfg);
  }

  async onModuleInit(): Promise<void> {
    this.log.log(
      `connecting to cassandra ${this.cfg.contactPoints.join(',')}:${this.cfg.cassandraPort} (dc ${this.cfg.localDc}, keyspace ${this.cfg.keyspace})`,
    );
    await this.client.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.shutdown();
  }
}
