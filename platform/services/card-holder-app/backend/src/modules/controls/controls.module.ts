import { Module } from '@nestjs/common';

import { FreezeCardHandler } from './commands/freeze-card.command';
import { ReleaseMerchantHandler } from './commands/release-merchant.command';
import { SetBudgetHandler } from './commands/set-budget.command';
import { SetMerchantRuleHandler } from './commands/set-merchant-rule.command';
import { UnfreezeCardHandler } from './commands/unfreeze-card.command';
import { ControlsController } from './controls.controller';
import { CardStatusRepository } from './repositories/card-status.repository';
import { ControlsRepository } from './repositories/controls.repository';
import { GetCardStatusHandler } from './queries/get-card-status.query';
import { GetControlsHandler } from './queries/get-controls.query';

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
})
export class ControlsModule {}
