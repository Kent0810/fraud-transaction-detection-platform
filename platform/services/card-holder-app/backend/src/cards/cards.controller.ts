import { Controller, DefaultValuePipe, Get, NotFoundException, Param, ParseIntPipe, Query } from '@nestjs/common';

import { CardsRepository } from './cards.repository';
import type { AlertDto, CardStateDto, TxnDto } from './cards.types';

const clamp = (n: number, max: number) => Math.min(Math.max(n, 1), max);

@Controller('cards')
export class CardsController {
  constructor(private readonly repo: CardsRepository) {}

  @Get()
  cards(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number): Promise<string[]> {
    return this.repo.cards(clamp(limit, 100));
  }

  @Get(':cardId/transactions')
  transactions(
    @Param('cardId') cardId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<TxnDto[]> {
    return this.repo.transactions(cardId, clamp(limit, 500));
  }

  @Get(':cardId/transactions/:txnId')
  async transaction(@Param('cardId') cardId: string, @Param('txnId') txnId: string): Promise<TxnDto> {
    const txn = await this.repo.transaction(cardId, txnId);
    if (!txn) throw new NotFoundException('transaction not found');
    return txn;
  }

  @Get(':cardId/alerts')
  alerts(
    @Param('cardId') cardId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<AlertDto[]> {
    return this.repo.alerts(cardId, clamp(limit, 500));
  }

  @Get(':cardId/state')
  async state(@Param('cardId') cardId: string): Promise<CardStateDto> {
    const state = await this.repo.cardState(cardId);
    if (!state) throw new NotFoundException('no case for this card');
    return state;
  }
}
