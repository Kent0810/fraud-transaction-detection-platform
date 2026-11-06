import { Inject, Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
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
  readonly client: Client;
  readonly mapper: mapping.Mapper;

  constructor(@Inject(CONFIG) cfg: Config) {
    this.client = createClient(cfg);
    this.mapper = createMapper(this.client);
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.shutdown();
  }
}
