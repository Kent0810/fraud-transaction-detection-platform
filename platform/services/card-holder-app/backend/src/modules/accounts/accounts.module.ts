import { Module } from '@nestjs/common';

import { AccountsController } from './accounts.controller';
import { AccountsRepository } from './repositories/accounts.repository';
import { GetAccountHolderHandler } from './queries/get-account-holder.query';
import { GetBalanceHandler } from './queries/get-balance.query';

@Module({
  controllers: [AccountsController],
  providers: [AccountsRepository, GetBalanceHandler, GetAccountHolderHandler],
})
export class AccountsModule {}
