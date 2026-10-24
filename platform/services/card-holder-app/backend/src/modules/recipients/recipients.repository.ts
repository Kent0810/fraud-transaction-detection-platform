import { Injectable } from '@nestjs/common';

import { iso } from '../../shared/cassandra/models';
import { PostgresService } from '../../shared/postgres/postgres.service';
import type { RecipientDto } from './recipients.types';

type RecipientRow = { bank_code: string; account: string; name: string; created_at: Date };

const toDto = (r: RecipientRow): RecipientDto => ({
  bankCode: r.bank_code,
  account: r.account,
  name: r.name,
  createdAt: iso(r.created_at) ?? '',
});

@Injectable()
export class RecipientsRepository {
  constructor(private readonly db: PostgresService) {}

  async forCard(cardId: string): Promise<RecipientDto[]> {
    const { rows } = await this.db.pool.query<RecipientRow>(
      'SELECT bank_code, account, name, created_at FROM saved_recipients WHERE card_id = $1 ORDER BY created_at DESC',
      [cardId],
    );
    return rows.map(toDto);
  }

  /** Saves, or renames if already saved. Keeps the original created_at so the list order stays put. */
  async save(cardId: string, bankCode: string, account: string, name: string): Promise<RecipientDto> {
    const { rows } = await this.db.pool.query<RecipientRow>(
      `INSERT INTO saved_recipients (card_id, bank_code, account, name) VALUES ($1, $2, $3, $4)
       ON CONFLICT (card_id, bank_code, account) DO UPDATE SET name = EXCLUDED.name
       RETURNING bank_code, account, name, created_at`,
      [cardId, bankCode, account, name],
    );
    return toDto(rows[0]);
  }

  async remove(cardId: string, bankCode: string, account: string): Promise<void> {
    await this.db.pool.query('DELETE FROM saved_recipients WHERE card_id = $1 AND bank_code = $2 AND account = $3', [
      cardId,
      bankCode,
      account,
    ]);
  }
}
