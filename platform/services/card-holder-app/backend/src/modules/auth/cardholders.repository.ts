import { Injectable } from '@nestjs/common';

import { PostgresService } from '../../shared/postgres/postgres.service';
import type { SessionDto } from './auth.types';

type LoginRow = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
  password_ok: boolean | null;
};

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

  /** The session for a valid, active login, or null. Records the login time on success. */
  async login(cardId: string, password: string): Promise<SessionDto | null> {
    const { rows } = await this.db.pool.query<LoginRow>(VERIFY_LOGIN, [cardId, password]);
    const row = rows[0];
    if (!row?.password_ok || row.status !== 'ACTIVE') return null;
    await this.db.pool.query('UPDATE auth SET last_login_at = now() WHERE card_id = $1', [cardId]);
    return { cardId, name: `${row.first_name} ${row.last_name}`, email: row.email ?? '' };
  }
}
