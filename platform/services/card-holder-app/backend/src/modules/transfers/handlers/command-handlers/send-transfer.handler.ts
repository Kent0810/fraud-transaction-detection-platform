import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { TransfersRepository } from '../../repositories/transfers.repository';
import type { TransferDto } from '../../types/transfers.types';
import { SendTransferCommand } from '../commands/send-transfer.command';

@CommandHandler(SendTransferCommand)
export class SendTransferHandler implements ICommandHandler<SendTransferCommand> {
  constructor(private readonly transfers: TransfersRepository) {}

  execute({ cardId, request }: SendTransferCommand): Promise<TransferDto> {
    return this.transfers.request(cardId, request);
  }
}
