import { Injectable } from '@nestjs/common';
import {
  bankByBin,
  BANKS,
  type Bank,
  getTransfer,
  OUR_BIN,
  requestTransfer,
  settle,
  type DecisionInput,
  type TransactionState,
  type TransactionStatus,
} from '@platform/db';

import { asHttpError } from '../../../common/refusals';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { TransferDto, TransferRequest } from '../types/transfers.types';

const toDto = (r: TransactionState): TransferDto => ({
  transferId: r.txn_id,
  reference: r.reference,
  to: {
    account: r.to_account ?? '',
    name: r.to_name ?? '',
    bank: bankByBin(r.to_bank ?? OUR_BIN) ?? { bin: r.to_bank ?? '', code: r.to_bank ?? '', name: r.to_bank ?? '' },
  },
  amount: Number(r.amount),
  fee: 0,
  content: r.content ?? '',
  status: r.status as TransactionStatus,
  declinedFor: r.declined_for,
  ts: r.created_at.toISOString(),
  decidedAt: r.decided_at?.toISOString() ?? null,
  balance: Number(r.balance),
});

@Injectable()
export class TransfersRepository {
  constructor(private readonly db: PrismaService) {}

  async request(fromCard: string, t: TransferRequest): Promise<TransferDto> {
    try {
      return toDto(await requestTransfer(this.db.client, { fromCard, ...t }));
    } catch (e) {
      throw asHttpError(e);
    }
  }

  // A card payment settles too, so the state is returned as it is: its transfer-only fields may be null.
  settle(decision: DecisionInput): Promise<TransactionState | null> {
    return settle(this.db.client, decision);
  }

  banks(): Bank[] {
    return BANKS;
  }

  async forCard(fromCard: string, transferId: string): Promise<TransferDto | null> {
    const t = await getTransfer(this.db.client, fromCard, transferId);
    return t && toDto(t);
  }
}
