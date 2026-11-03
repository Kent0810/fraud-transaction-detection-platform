import { Module } from '@nestjs/common';

import { ControlsController } from './controls.controller';
import { FreezeCardHandler } from './handlers/command-handlers/freeze-card.handler';
import { ReleaseRecipientHandler } from './handlers/command-handlers/release-recipient.handler';
import { SetBudgetHandler } from './handlers/command-handlers/set-budget.handler';
import { SetRecipientRuleHandler } from './handlers/command-handlers/set-recipient-rule.handler';
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
    SetRecipientRuleHandler,
    ReleaseRecipientHandler,
    FreezeCardHandler,
    UnfreezeCardHandler,
    GetControlsHandler,
    GetCardStatusHandler,
  ],
  exports: [ControlsRepository, CardStatusRepository],
})
export class ControlsModule {}
