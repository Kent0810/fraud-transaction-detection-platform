import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { postTransfer, type PostedTransfer, TransferRefusedError, type TransferRefusalCode } from '@platform/db';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import { OUR_BANK, type TransferDto, type TransferRequest } from '../transfers.types';

// 403, not 401, for a wrong password: the session is still valid and the app shouldn't sign out.
const REFUSALS: Record<TransferRefusalCode, new (message: string) => HttpException> = {
  INCORRECT_PASSWORD: ForbiddenException,
  ACCOUNT_NOT_FOUND: NotFoundException,
  OWN_ACCOUNT: UnprocessableEntityException,
  INSUFFICIENT_FUNDS: UnprocessableEntityException,
  TRANSFER_ID_REUSED: ConflictException,
};

const toDto = (r: PostedTransfer): TransferDto => ({
  transferId: r.transfer_id,
  reference: r.reference,
  kind: r.to_bank_code === OUR_BANK ? 'INTERNAL' : 'NAPAS',
  to: { bankCode: r.to_bank_code, account: r.to_account, name: r.to_name },
  amount: Number(r.amount),
  fee: 0,
  content: r.content,
  ts: r.created_at.toISOString(),
  balance: Number(r.balance),
});

@Injectable()
export class TransfersRepository {
  constructor(private readonly db: PrismaService) {}

  /**
   * Moves the money through @platform/db's postTransfer(): the password check, then the transfer, both balances, the
   * ledger and the outbox event in one transaction. Sending the same transferId again returns the first result.
   */
  async post(fromCard: string, t: TransferRequest): Promise<TransferDto> {
    try {
      return toDto(await postTransfer(this.db.client, { fromCard, ...t }));
    } catch (e) {
      if (e instanceof TransferRefusedError) throw new REFUSALS[e.code](e.message);
      throw e;
    }
  }
}
