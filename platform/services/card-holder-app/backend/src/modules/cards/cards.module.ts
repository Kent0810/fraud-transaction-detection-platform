import { Module } from '@nestjs/common';

import { CardsController } from './cards.controller';
import { CardsRepository } from './repositories/cards.repository';
import { GetAlertsHandler } from './queries/get-alerts.query';
import { GetCardStateHandler } from './queries/get-card-state.query';
import { GetTransactionHandler } from './queries/get-transaction.query';
import { GetTransactionsHandler } from './queries/get-transactions.query';

@Module({
  controllers: [CardsController],
  providers: [
    CardsRepository,
    GetTransactionsHandler,
    GetTransactionHandler,
    GetAlertsHandler,
    GetCardStateHandler,
  ],
})
export class CardsModule {}
