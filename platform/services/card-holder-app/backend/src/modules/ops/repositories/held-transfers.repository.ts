import { Injectable } from '@nestjs/common';
import { bankByBin, OUR_BANK, type TransactionState } from '@platform/db';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import { accountRecipient, type Recipient } from '../../controls/types/recipient';
import type { HeldTransferDto } from '../types/ops.types';

type Transaction = Omit<TransactionState, 'balance'>;

/** Transfers held for an agent (AMOUNT_SPIKE). PostgreSQL is the record: the money waits on its status. */
@Injectable()
export class HeldTransfersRepository {
  constructor(private readonly db: PrismaService) {}

  async list(cardId?: string): Promise<HeldTransferDto[]> {
    const rows = await this.db.client.transactions.findMany({
      where: { status: 'HELD', ...(cardId ? { card_id: cardId } : {}) },
      orderBy: { held_until: 'asc' },
      take: 500,
    });
    return rows.map((t) => ({
      cardId: t.card_id,
      txnId: t.txn_id,
      ts: t.created_at.toISOString(),
      amount: Number(t.amount),
      toName: t.to_name ?? '',
      toAccount: t.to_account ?? '',
      heldUntil: t.held_until?.toISOString() ?? '',
    }));
  }

  find(cardId: string, txnId: string): Promise<Transaction | null> {
    return this.db.client.transactions.findFirst({ where: { card_id: cardId, txn_id: txnId, channel: 'TRANSFER' } });
  }
}

/** The recipient as the fraud detector names it (RecipientId.of): BANK:account. */
export function transferRecipient(t: Transaction): Recipient {
  const bank = t.to_bank ? (bankByBin(t.to_bank)?.code ?? t.to_bank) : OUR_BANK;
  return accountRecipient(`${bank}:${t.to_account}`, t.to_name);
}
