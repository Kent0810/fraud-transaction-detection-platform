import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DatabaseError } from 'pg';

import { PostgresService } from '../../../shared/postgres/postgres.service';
import { OUR_BANK, type TransferDto, type TransferRequest } from '../transfers.types';

type PostedRow = {
  transfer_id: string;
  reference: string;
  to_bank_code: string;
  to_account: string;
  to_name: string;
  amount: string;
  content: string;
  created_at: Date;
  balance: string;
};

// post_transfer() raises these SQLSTATEs (V6__post_transfer.sql); its message is safe to return as is.
// 403, not 401, for a wrong password: the session is still valid and the app shouldn't sign out.
const REFUSALS: Record<string, new (message: string) => HttpException> = {
  TF401: UnauthorizedException,
  TF402: UnprocessableEntityException,
  TF403: ForbiddenException,
  TF404: NotFoundException,
  TF409: ConflictException,
  TF422: UnprocessableEntityException,
};

const toDto = (r: PostedRow): TransferDto => ({
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
  constructor(private readonly db: PostgresService) {}

  /**
   * Moves the money through post_transfer(), the only thing this login may do to balances. It checks the session and
   * the password, and writes the transfer, both balances, the ledger and the outbox event in one transaction.
   * Sending the same transferId again returns the first result and moves nothing.
   */
  async post(sessionToken: string, t: TransferRequest): Promise<TransferDto> {
    try {
      const { rows } = await this.db.pool.query<PostedRow>('SELECT * FROM post_transfer($1, $2, $3, $4, $5, $6, $7, $8)', [
        sessionToken,
        t.password,
        t.transferId,
        t.toBankCode,
        t.toAccount,
        t.toName,
        t.amount,
        t.content,
      ]);
      return toDto(rows[0]);
    } catch (e) {
      const Refusal = e instanceof DatabaseError && e.code ? REFUSALS[e.code] : undefined;
      if (Refusal) throw new Refusal(e instanceof Error ? e.message : 'transfer refused');
      throw e;
    }
  }
}
