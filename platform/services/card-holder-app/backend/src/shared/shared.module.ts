import { Global, Module } from '@nestjs/common';

import { CassandraService } from './cassandra/cassandra.service';
import { PrismaService } from './prisma/prisma.service';

@Global()
@Module({
  providers: [CassandraService, PrismaService],
  exports: [CassandraService, PrismaService],
})
export class SharedModule {}
