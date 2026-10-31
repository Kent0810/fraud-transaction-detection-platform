import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { CurrentCard } from '../../common/decorators/session.decorator';
import { ZodPipe } from '../../common/validation';
import { SendTransferCommand } from './commands/send-transfer.command';
import { GetTransferQuery } from './queries/get-transfer.query';
import type { Bank } from '@platform/db';

import { TransfersRepository } from './repositories/transfers.repository';
import { TransferId, type TransferDto, TransferRequest } from './types/transfers.types';

@Controller('me/transfers')
export class TransfersController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
    private readonly transfers: TransfersRepository,
  ) {}

  // This bank first, then the others a transfer can reach through NAPAS. Before :transferId, which would take it.
  @Get('banks')
  banks(): Bank[] {
    return this.transfers.banks();
  }

  // POST with a client-made transferId: retrying after a timeout returns the same transfer instead of sending twice.
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  send(@CurrentCard() cardId: string, @Body(new ZodPipe(TransferRequest)) body: TransferRequest): Promise<TransferDto> {
    return this.commands.execute(new SendTransferCommand(cardId, body));
  }

  @Get(':transferId')
  async get(
    @CurrentCard() cardId: string,
    @Param('transferId', new ZodPipe(TransferId)) transferId: string,
  ): Promise<TransferDto> {
    const transfer = await this.queries.execute(new GetTransferQuery(cardId, transferId));
    if (!transfer) throw new NotFoundException('transfer not found');
    return transfer;
  }
}
