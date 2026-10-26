import { Controller, DefaultValuePipe, Get, NotFoundException, Param, ParseIntPipe, Query, Res } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { Response } from 'express';

import { CurrentCard } from '../../common/decorators/session.decorator';
import { clamp, Cursor, NEXT_CURSOR, ZodPipe } from '../../common/validation';
import type { AlertDto, CardStateDto, TxnDto } from './cards.types';
import { GetAlertsQuery } from './queries/get-alerts.query';
import { GetCardStateQuery } from './queries/get-card-state.query';
import { GetTransactionQuery } from './queries/get-transaction.query';
import { GetTransactionsQuery } from './queries/get-transactions.query';

@Controller('me')
export class CardsController {
  constructor(private readonly queries: QueryBus) {}

  @Get('transactions')
  async transactions(
    @CurrentCard() cardId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('cursor', new ZodPipe(Cursor)) cursor: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TxnDto[]> {
    const page = await this.queries.execute(new GetTransactionsQuery(cardId, clamp(limit, 500), cursor));
    if (page.nextCursor) res.setHeader(NEXT_CURSOR, page.nextCursor);
    return page.items;
  }

  @Get('transactions/:txnId')
  async transaction(@CurrentCard() cardId: string, @Param('txnId') txnId: string): Promise<TxnDto> {
    const txn = await this.queries.execute(new GetTransactionQuery(cardId, txnId));
    if (!txn) throw new NotFoundException('transaction not found');
    return txn;
  }

  @Get('alerts')
  alerts(
    @CurrentCard() cardId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<AlertDto[]> {
    return this.queries.execute(new GetAlertsQuery(cardId, clamp(limit, 500)));
  }

  @Get('state')
  async state(@CurrentCard() cardId: string): Promise<CardStateDto> {
    const state = await this.queries.execute(new GetCardStateQuery(cardId));
    if (!state) throw new NotFoundException('no case for this card');
    return state;
  }
}
