import { Module } from '@nestjs/common';

import { CardsController } from './cards.controller';
import { GetAlertsHandler } from './handlers/query-handlers/get-alerts.handler';
import { GetCardStateHandler } from './handlers/query-handlers/get-card-state.handler';
import { GetTransactionHandler } from './handlers/query-handlers/get-transaction.handler';
import { GetTransactionsHandler } from './handlers/query-handlers/get-transactions.handler';
import { CardsRepository } from './repositories/cards.repository';

@Module({
  controllers: [CardsController],
  providers: [CardsRepository, GetTransactionsHandler, GetTransactionHandler, GetAlertsHandler, GetCardStateHandler],
  exports: [CardsRepository],
})
export class CardsModule {}
