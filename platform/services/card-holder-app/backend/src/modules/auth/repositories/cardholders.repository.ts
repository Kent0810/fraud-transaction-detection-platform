import { Injectable } from '@nestjs/common';

import { PostgresService } from '../../../shared/postgres/postgres.service';

type LoginRow = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
  password_ok: boolean | null;
};

export type Cardholder = { cardId: string; name: string; email: string };

// Always returns one row and always runs crypt(): an unknown card hashes against a throwaway salt,
// so it takes as long as a wrong password and login timing can't be used to probe card numbers.
const VERIFY_LOGIN = `
  SELECT c.first_name, c.last_name, c.email, l.status,
         l.password_hash = crypt($2, coalesce(l.password_hash, gen_salt('bf', 8))) AS password_ok
  FROM (VALUES ($1::text)) AS q (card_id)
  LEFT JOIN auth l USING (card_id)
  LEFT JOIN cardholders c USING (card_id)`;

@Injectable()
export class CardholdersRepository {
  constructor(private readonly db: PostgresService) {}

  /** The cardholder for a valid, active login, or null. Records the login time on success. */
  async login(cardId: string, password: string): Promise<Cardholder | null> {
    const row = await this.check(cardId, password);
    if (!row) return null;
    await this.db.pool.query('UPDATE auth SET last_login_at = now() WHERE card_id = $1', [cardId]);
    return { cardId, name: `${row.first_name} ${row.last_name}`, email: row.email ?? '' };
  }

  private async check(cardId: string, password: string): Promise<LoginRow | null> {
    const { rows } = await this.db.pool.query<LoginRow>(VERIFY_LOGIN, [cardId, password]);
    const row = rows[0];
    return row?.password_ok && row.status === 'ACTIVE' ? row : null;
  }
}
