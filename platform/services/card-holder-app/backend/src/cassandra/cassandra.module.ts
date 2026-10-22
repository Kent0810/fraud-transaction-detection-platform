import { Global, Module } from '@nestjs/common';

import { loadConfig } from '../config';
import { CONFIG } from './cassandra.module.tokens';
import { CassandraService } from './cassandra.service';

@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: loadConfig }, CassandraService],
  exports: [CONFIG, CassandraService],
})
export class CassandraModule {}
