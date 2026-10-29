import { Logger } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { TransfersRepository } from '../repositories/transfers.repository';
import type { TransferDecisionMessage, TransferDto } from '../types/transfers.types';

export class SettleTransferCommand extends Command<TransferDto | null> {
  constructor(readonly decision: TransferDecisionMessage) {
    super();
  }
}

@CommandHandler(SettleTransferCommand)
export class SettleTransferHandler implements ICommandHandler<SettleTransferCommand> {
  private readonly log = new Logger(SettleTransferHandler.name);

  constructor(private readonly transfers: TransfersRepository) {}

  async execute({ decision }: SettleTransferCommand): Promise<TransferDto | null> {
    const settled = await this.transfers.settle({
      transferId: decision.txn_id,
      approve: decision.decision === 'APPROVE',
      firedRules: decision.fired_rules,
    });
    if (!settled) {
      this.log.warn(`decision for unknown transfer ${decision.txn_id}`);
    } else {
      this.log.log(`transfer ${settled.reference} ${settled.status} ${settled.declinedFor.join(',')}`);
    }
    return settled;
  }
}
