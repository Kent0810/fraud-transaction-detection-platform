import { Module } from '@nestjs/common';

import { SessionsRepository } from './auth/sessions.repository';
import { CardholderGuard, StaffGuard } from './auth/guards';
import { ConfigModule } from './config.module';
import { EventsService } from './events/events.service';
import { KafkaModule } from './kafka/kafka.module';
import { LiveController } from './live/live.controller';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [ConfigModule, KafkaModule],
  controllers: [LiveController],
  providers: [PrismaService, SessionsRepository, EventsService, CardholderGuard, StaffGuard],
})
export class AppModule {}
