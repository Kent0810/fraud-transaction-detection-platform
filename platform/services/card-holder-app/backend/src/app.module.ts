import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { AuthModule } from './auth/auth.module';
import { CardsModule } from './cards/cards.module';
import { ConfigModule } from './config.module';
import { ControlsModule } from './controls/controls.module';
import { HealthController } from './health/health.controller';
import { KafkaModule } from './kafka/kafka.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [CqrsModule.forRoot(), ConfigModule, SharedModule, KafkaModule, AuthModule, CardsModule, ControlsModule],
  controllers: [HealthController],
})
export class AppModule {}
