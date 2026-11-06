import { Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { TransfersRepository } from '../../repositories/transfers.repository';
import { SettleCommand } from '../commands/settle.command';

@CommandHandler(SettleCommand)
export class SettleHandler implements ICommandHandler<SettleCommand> {
  private readonly log = new Logger(SettleHandler.name);

  constructor(private readonly transfers: TransfersRepository) {}

  async execute({ decision: d }: SettleCommand): Promise<boolean> {
    const settled = await this.transfers.settle({
      txnId: d.txn_id,
      cardId: d.card_id,
      channel: d.channel,
      ts: d.ts,
      merchant: d.merchant ?? null,
      category: d.category ?? null,
      amount: d.amount,
      merchLat: d.merch_lat ?? null,
      merchLong: d.merch_long ?? null,
      verdict: d.decision,
      firedRules: d.fired_rules,
    });
    if (!settled) {
      this.log.warn(`decision for unknown ${d.channel} ${d.txn_id} on card ${d.card_id}`);
      return false;
    }
    return true;
  }
}
