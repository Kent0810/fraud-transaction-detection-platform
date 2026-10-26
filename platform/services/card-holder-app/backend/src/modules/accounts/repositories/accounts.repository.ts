import { Injectable } from '@nestjs/common';

import { iso } from '../../../shared/cassandra/models';
import { PostgresService } from '../../../shared/postgres/postgres.service';
import type { AccountHolderDto, BalanceDto } from '../accounts.types';

// pg returns bigint as a string; Number is exact up to 2^53, far above any demo balance.
type AccountRow = { account_number: string; balance: string; currency: string; updated_at: Date };

@Injectable()
export class AccountsRepository {
  constructor(private readonly db: PostgresService) {}

  async balance(cardId: string): Promise<BalanceDto | null> {
    const { rows } = await this.db.pool.query<AccountRow>(
      'SELECT account_number, balance, currency, updated_at FROM accounts WHERE card_id = $1',
      [cardId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      cardId,
      accountNumber: row.account_number,
      balance: Number(row.balance),
      currency: row.currency,
      updatedAt: iso(row.updated_at) ?? '',
    };
  }

  async holder(accountNumber: string): Promise<AccountHolderDto | null> {
    const { rows } = await this.db.pool.query<{ name: string }>(
      `SELECT upper(c.first_name || ' ' || c.last_name) AS name
       FROM accounts a JOIN cardholders c USING (card_id)
       WHERE a.account_number = $1`,
      [accountNumber],
    );
    return rows[0] ? { accountNumber, name: rows[0].name } : null;
  }
}
