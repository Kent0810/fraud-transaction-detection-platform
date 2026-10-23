import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { AccountsModule } from './accounts/accounts.module';
import { AuthModule } from './auth/auth.module';
import { CardsModule } from './cards/cards.module';
import { ConfigModule } from './config.module';
import { ControlsModule } from './controls/controls.module';
import { HealthController } from './health/health.controller';
import { KafkaModule } from './kafka/kafka.module';
import { RecipientsModule } from './recipients/recipients.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [CqrsModule.forRoot(), ConfigModule, SharedModule, KafkaModule, AuthModule, AccountsModule, CardsModule, ControlsModule, RecipientsModule],
  controllers: [HealthController],
})
export class AppModule {}
