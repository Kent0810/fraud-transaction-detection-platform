import { Module } from '@nestjs/common';

import { CardsController } from './cards.controller';
import { CardsRepository } from './cards.repository';
import { GetAlertsHandler } from './queries/get-alerts.query';
import { GetCardStateHandler } from './queries/get-card-state.query';
import { GetTransactionHandler } from './queries/get-transaction.query';
import { GetTransactionsHandler } from './queries/get-transactions.query';
import { ListCardsHandler } from './queries/list-cards.query';

@Module({
  controllers: [CardsController],
  providers: [
    CardsRepository,
    ListCardsHandler,
    GetTransactionsHandler,
    GetTransactionHandler,
    GetAlertsHandler,
    GetCardStateHandler,
  ],
})
export class CardsModule {}
