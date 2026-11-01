import { Module } from '@nestjs/common';

import { AccountsController } from './accounts.controller';
import { GetAccountHolderHandler } from './handlers/query-handlers/get-account-holder.handler';
import { GetBalanceHandler } from './handlers/query-handlers/get-balance.handler';
import { GetProfileHandler } from './handlers/query-handlers/get-profile.handler';
import { AccountsRepository } from './repositories/accounts.repository';

@Module({
  controllers: [AccountsController],
  providers: [AccountsRepository, GetBalanceHandler, GetAccountHolderHandler, GetProfileHandler],
})
export class AccountsModule {}
