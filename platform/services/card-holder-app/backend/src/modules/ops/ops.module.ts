import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { CardsModule } from '../cards/cards.module';
import { ControlsModule } from '../controls/controls.module';
import { LiveAlertsConsumer } from './consumers/live-alerts.consumer';
import { StaffGuard } from './guards/staff.guard';
import { OpenCardHandler } from './handlers/command-handlers/open-card.handler';
import { ReviewAlertHandler } from './handlers/command-handlers/review-alert.handler';
import { SetCardFrozenHandler } from './handlers/command-handlers/set-card-frozen.handler';
import { SetLoginEnabledHandler } from './handlers/command-handlers/set-login-enabled.handler';
import { StaffLoginHandler } from './handlers/command-handlers/staff-login.handler';
import { StaffLogoutHandler } from './handlers/command-handlers/staff-logout.handler';
import { FindCardHandler } from './handlers/query-handlers/find-card.handler';
import { GetActivityHandler } from './handlers/query-handlers/get-activity.handler';
import { GetAuditTrailHandler } from './handlers/query-handlers/get-audit-trail.handler';
import { GetQueueHandler } from './handlers/query-handlers/get-queue.handler';
import { GetRecentCardsHandler } from './handlers/query-handlers/get-recent-cards.handler';
import { OpsAuthController } from './ops-auth.controller';
import { OpsController } from './ops.controller';
import { CardholderFilesRepository } from './repositories/cardholder-files.repository';
import { CasesRepository } from './repositories/cases.repository';
import { LoginsRepository } from './repositories/logins.repository';
import { StaffRepository } from './repositories/staff.repository';

// The operations console's API: analysts and agents, signed in as staff (StaffGuard), never as a cardholder.
@Module({
  imports: [CardsModule, ControlsModule],
  controllers: [OpsAuthController, OpsController],
  providers: [
    StaffRepository,
    CasesRepository,
    CardholderFilesRepository,
    LoginsRepository,
    LiveAlertsConsumer,
    StaffLoginHandler,
    StaffLogoutHandler,
    OpenCardHandler,
    ReviewAlertHandler,
    SetCardFrozenHandler,
    SetLoginEnabledHandler,
    GetQueueHandler,
    GetActivityHandler,
    GetAuditTrailHandler,
    GetRecentCardsHandler,
    FindCardHandler,
    { provide: APP_GUARD, useClass: StaffGuard },
  ],
})
export class OpsModule {}
