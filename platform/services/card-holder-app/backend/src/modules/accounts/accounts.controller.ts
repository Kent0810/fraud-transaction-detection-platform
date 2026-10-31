import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

import { CurrentCard } from '../../common/decorators/session.decorator';
import { AccountNumber, ZodPipe } from '../../common/validation';
import type { AccountHolderDto, BalanceDto, ProfileDto } from './types/accounts.types';
import { GetAccountHolderQuery } from './queries/get-account-holder.query';
import { GetBalanceQuery } from './queries/get-balance.query';
import { GetProfileQuery } from './queries/get-profile.query';

@Controller()
export class AccountsController {
  constructor(private readonly queries: QueryBus) {}

  @Get('me/balance')
  async balance(@CurrentCard() cardId: string): Promise<BalanceDto> {
    const balance = await this.queries.execute(new GetBalanceQuery(cardId));
    if (!balance) throw new NotFoundException('account not found');
    return balance;
  }

  // The card is the session's: a cardholder can only ever read their own details.
  @Get('me/profile')
  async profile(@CurrentCard() cardId: string): Promise<ProfileDto> {
    const profile = await this.queries.execute(new GetProfileQuery(cardId));
    if (!profile) throw new NotFoundException('account not found');
    return profile;
  }

  // Recipient check for a same-bank transfer.
  @Get('accounts/:accountNumber')
  async holder(@Param('accountNumber', new ZodPipe(AccountNumber)) accountNumber: string): Promise<AccountHolderDto> {
    const holder = await this.queries.execute(new GetAccountHolderQuery(accountNumber));
    if (!holder) throw new NotFoundException('account not found');
    return holder;
  }
}
