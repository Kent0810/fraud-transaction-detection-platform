import { Module } from '@nestjs/common';

import { CardsModule } from './cards/cards.module';
import { CassandraModule } from './cassandra/cassandra.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [CassandraModule, CardsModule],
  controllers: [HealthController],
})
export class AppModule {}
