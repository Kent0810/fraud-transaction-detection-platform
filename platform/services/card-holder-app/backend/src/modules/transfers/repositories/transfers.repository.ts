import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  getTransfer,
  requestTransfer,
  settleTransfer,
  type TransferDecision,
  TransferRefusedError,
  type TransferRefusalCode,
  type TransferState,
  type TransferStatus,
} from '@platform/db';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import { OUR_BANK, type TransferDto, type TransferRequest } from '../types/transfers.types';

class CardFrozenException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.LOCKED);
  }
}

// 403, not 401, for a wrong password: the session is still valid and the app shouldn't sign out.
const REFUSALS: Record<TransferRefusalCode, new (message: string) => HttpException> = {
  CARD_FROZEN: CardFrozenException,
  INCORRECT_PASSWORD: ForbiddenException,
  ACCOUNT_NOT_FOUND: NotFoundException,
  OWN_ACCOUNT: UnprocessableEntityException,
  INSUFFICIENT_FUNDS: UnprocessableEntityException,
  TRANSFER_ID_REUSED: ConflictException,
};

const toDto = (r: TransferState): TransferDto => ({
  transferId: r.transfer_id,
  reference: r.reference,
  kind: r.to_bank_code === OUR_BANK ? 'INTERNAL' : 'NAPAS',
  to: {
    bankCode: r.to_bank_code,
    account: r.to_account,
    name: r.to_name,
  },
  amount: Number(r.amount),
  fee: 0,
  content: r.content,
  status: r.status as TransferStatus,
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
      if (e instanceof TransferRefusedError) throw new REFUSALS[e.code](e.message);
      throw e;
    }
  }

  async settle(decision: TransferDecision): Promise<TransferDto | null> {
    const settled = await settleTransfer(this.db.client, decision);
    return settled && toDto(settled);
  }

  async forCard(fromCard: string, transferId: string): Promise<TransferDto | null> {
    const t = await getTransfer(this.db.client, fromCard, transferId);
    return t && toDto(t);
  }
}
