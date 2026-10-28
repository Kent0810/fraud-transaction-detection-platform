import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { AccountsModule } from './modules/accounts/accounts.module';
import { AuthModule } from './modules/auth/auth.module';
import { CardsModule } from './modules/cards/cards.module';
import { ConfigModule } from './config.module';
import { ControlsModule } from './modules/controls/controls.module';
import { HealthController } from './health/health.controller';
import { KafkaModule } from './kafka/kafka.module';
import { RecipientsModule } from './modules/recipients/recipients.module';
import { SharedModule } from './shared/shared.module';
import { TransfersModule } from './modules/transfers/transfers.module';

@Module({
  imports: [
    CqrsModule.forRoot(),
    ConfigModule,
    SharedModule,
    KafkaModule,
    AuthModule,
    AccountsModule,
    CardsModule,
    ControlsModule,
    RecipientsModule,
    TransfersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
