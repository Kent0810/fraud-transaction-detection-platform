import { Module } from '@nestjs/common';

import { ReleaseMerchantHandler } from './commands/release-merchant.command';
import { SetBudgetHandler } from './commands/set-budget.command';
import { SetMerchantRuleHandler } from './commands/set-merchant-rule.command';
import { ControlsController } from './controls.controller';
import { ControlsRepository } from './repositories/controls.repository';
import { GetControlsHandler } from './queries/get-controls.query';

@Module({
  controllers: [ControlsController],
  providers: [ControlsRepository, SetBudgetHandler, SetMerchantRuleHandler, ReleaseMerchantHandler, GetControlsHandler],
})
export class ControlsModule {}
