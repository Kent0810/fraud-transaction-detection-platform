import { Global, Module } from '@nestjs/common';

import { CassandraService } from './cassandra/cassandra.service';
import { PostgresService } from './postgres/postgres.service';

@Global()
@Module({
  providers: [CassandraService, PostgresService],
  exports: [CassandraService, PostgresService],
})
export class SharedModule {}
