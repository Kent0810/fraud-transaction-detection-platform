import { Module } from '@nestjs/common';

import { ControlsController } from './controls.controller';
import { FreezeCardHandler } from './handlers/command-handlers/freeze-card.handler';
import { ReleaseMerchantHandler } from './handlers/command-handlers/release-merchant.handler';
import { SetBudgetHandler } from './handlers/command-handlers/set-budget.handler';
import { SetMerchantRuleHandler } from './handlers/command-handlers/set-merchant-rule.handler';
import { UnfreezeCardHandler } from './handlers/command-handlers/unfreeze-card.handler';
import { GetCardStatusHandler } from './handlers/query-handlers/get-card-status.handler';
import { GetControlsHandler } from './handlers/query-handlers/get-controls.handler';
import { CardStatusRepository } from './repositories/card-status.repository';
import { ControlsRepository } from './repositories/controls.repository';

@Module({
  controllers: [ControlsController],
  providers: [
    ControlsRepository,
    CardStatusRepository,
    SetBudgetHandler,
    SetMerchantRuleHandler,
    ReleaseMerchantHandler,
    FreezeCardHandler,
    UnfreezeCardHandler,
    GetControlsHandler,
    GetCardStatusHandler,
  ],
  exports: [ControlsRepository, CardStatusRepository],
})
export class ControlsModule {}
