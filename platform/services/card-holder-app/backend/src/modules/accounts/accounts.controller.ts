import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

import { CardIdPipe } from '../../common/validation';
import { type AccountHolderDto, accountNumber, type BalanceDto } from './accounts.types';
import { GetAccountHolderQuery } from './queries/get-account-holder.query';
import { GetBalanceQuery } from './queries/get-balance.query';

@Controller()
export class AccountsController {
  constructor(private readonly queries: QueryBus) {}

  @Get('cards/:cardId/balance')
  async balance(@Param('cardId', CardIdPipe) cardId: string): Promise<BalanceDto> {
    const balance = await this.queries.execute(new GetBalanceQuery(cardId));
    if (!balance) throw new NotFoundException('account not found');
    return balance;
  }

  // Recipient check for a same-bank transfer.
  @Get('accounts/:accountNumber')
  async holder(@Param('accountNumber') raw: string): Promise<AccountHolderDto> {
    const holder = await this.queries.execute(new GetAccountHolderQuery(accountNumber(raw)));
    if (!holder) throw new NotFoundException('account not found');
    return holder;
  }
}
