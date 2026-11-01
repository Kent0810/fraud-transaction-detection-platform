import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { ConfigModule } from './config.module';
import { HealthController } from './health/health.controller';
import { KafkaModule } from './kafka/kafka.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AuthModule } from './modules/auth/auth.module';
import { CardsModule } from './modules/cards/cards.module';
import { ControlsModule } from './modules/controls/controls.module';
import { OpsModule } from './modules/ops/ops.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RecipientsModule } from './modules/recipients/recipients.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { SharedModule } from './shared/shared.module';

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
    OpsModule,
    PaymentsModule,
    TransfersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
