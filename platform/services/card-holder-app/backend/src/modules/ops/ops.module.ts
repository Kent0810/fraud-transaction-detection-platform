import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { CardsModule } from '../cards/cards.module';
import { ControlsModule } from '../controls/controls.module';
import { OpenCardHandler } from './commands/open-card.command';
import { ReviewAlertHandler } from './commands/review-alert.command';
import { SetCardFrozenHandler } from './commands/set-card-frozen.command';
import { SetLoginEnabledHandler } from './commands/set-login-enabled.command';
import { StaffLoginHandler } from './commands/staff-login.command';
import { StaffLogoutHandler } from './commands/staff-logout.command';
import { LiveAlertsConsumer } from './consumers/live-alerts.consumer';
import { StaffGuard } from './guards/staff.guard';
import { OpsAuthController } from './ops-auth.controller';
import { OpsController } from './ops.controller';
import { FindCardHandler } from './queries/find-card.query';
import { GetActivityHandler } from './queries/get-activity.query';
import { GetAuditTrailHandler } from './queries/get-audit-trail.query';
import { GetRecentCardsHandler } from './queries/get-recent-cards.query';
import { GetQueueHandler } from './queries/get-queue.query';
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
