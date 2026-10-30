import { Logger } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { TransfersRepository } from '../repositories/transfers.repository';
import type { DecisionMessage } from '../types/transfers.types';

// Applies the fraud detector's verdict to the ledger. Null when the card or transfer is unknown.
export class SettleCommand extends Command<boolean> {
  constructor(readonly decision: DecisionMessage) {
    super();
  }
}

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
    this.log.log(`${d.channel} ${settled.reference} ${settled.status} ${settled.declined_for.join(',')}`);
    return true;
  }
}
