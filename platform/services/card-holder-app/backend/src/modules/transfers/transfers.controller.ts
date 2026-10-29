import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { CurrentCard } from '../../common/decorators/session.decorator';
import { ZodPipe } from '../../common/validation';
import { SendTransferCommand } from './commands/send-transfer.command';
import { type TransferDto, TransferRequest } from './types/transfers.types';

@Controller('me/transfers')
export class TransfersController {
  constructor(private readonly commands: CommandBus) {}

  // POST with a client-made transferId: retrying after a timeout returns the same transfer instead of sending twice.
  @Post()
  send(@CurrentCard() cardId: string, @Body(new ZodPipe(TransferRequest)) body: TransferRequest): Promise<TransferDto> {
    return this.commands.execute(new SendTransferCommand(cardId, body));
  }
}
