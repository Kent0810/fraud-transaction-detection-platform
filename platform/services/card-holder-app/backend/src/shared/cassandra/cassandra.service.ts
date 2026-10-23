import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Client, mapping } from 'cassandra-driver';

import type { CassandraConfig, Config } from '../../config';
import { CONFIG } from '../../config.module';
import { MODELS } from './models';

export function createClient(cfg: CassandraConfig): Client {
  return new Client({
    contactPoints: cfg.contactPoints,
    protocolOptions: { port: cfg.cassandraPort },
    localDataCenter: cfg.localDc,
    keyspace: cfg.keyspace,
  });
}

export function createMapper(client: Client): mapping.Mapper {
  return new mapping.Mapper(client, MODELS);
}

@Injectable()
export class CassandraService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger(CassandraService.name);
  readonly client: Client;
  readonly mapper: mapping.Mapper;

  constructor(@Inject(CONFIG) private readonly cfg: Config) {
    this.client = createClient(cfg);
    this.mapper = createMapper(this.client);
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
