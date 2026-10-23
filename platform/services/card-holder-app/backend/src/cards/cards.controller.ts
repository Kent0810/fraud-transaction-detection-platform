import { Controller, DefaultValuePipe, Get, NotFoundException, Param, ParseIntPipe, Query, Res } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { Response } from 'express';

import { CardIdPipe, clamp, CursorPipe, NEXT_CURSOR } from '../common/validation';
import type { AlertDto, CardStateDto, TxnDto } from './cards.types';
import { GetAlertsQuery } from './queries/get-alerts.query';
import { GetCardStateQuery } from './queries/get-card-state.query';
import { GetTransactionQuery } from './queries/get-transaction.query';
import { GetTransactionsQuery } from './queries/get-transactions.query';
import { ListCardsQuery } from './queries/list-cards.query';

@Controller('cards')
export class CardsController {
  constructor(private readonly queries: QueryBus) {}

  @Get()
  cards(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number): Promise<string[]> {
    return this.queries.execute(new ListCardsQuery(clamp(limit, 100)));
  }

  @Get(':cardId/transactions')
  async transactions(
    @Param('cardId', CardIdPipe) cardId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('cursor', CursorPipe) cursor: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TxnDto[]> {
    const page = await this.queries.execute(new GetTransactionsQuery(cardId, clamp(limit, 500), cursor));
    if (page.nextCursor) res.setHeader(NEXT_CURSOR, page.nextCursor);
    return page.items;
  }

  @Get(':cardId/transactions/:txnId')
  async transaction(@Param('cardId', CardIdPipe) cardId: string, @Param('txnId') txnId: string): Promise<TxnDto> {
    const txn = await this.queries.execute(new GetTransactionQuery(cardId, txnId));
    if (!txn) throw new NotFoundException('transaction not found');
    return txn;
  }

  @Get(':cardId/alerts')
  alerts(
    @Param('cardId', CardIdPipe) cardId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<AlertDto[]> {
    return this.queries.execute(new GetAlertsQuery(cardId, clamp(limit, 500)));
  }

  @Get(':cardId/state')
  async state(@Param('cardId', CardIdPipe) cardId: string): Promise<CardStateDto> {
    const state = await this.queries.execute(new GetCardStateQuery(cardId));
    if (!state) throw new NotFoundException('no case for this card');
    return state;
  }
}
