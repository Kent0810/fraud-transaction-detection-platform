import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { PostgresService } from '../../../shared/postgres/postgres.service';

// Absolute lifetime; the app signs in again after this.
const SESSION_HOURS = 12;

const hash = (token: string) => createHash('sha256').update(token).digest();

export type NewSession = { token: string; expiresAt: Date };

@Injectable()
export class SessionsRepository {
  constructor(private readonly db: PostgresService) {}

  /** 256 random bits; only the hash is stored. Also clears this card's expired sessions. */
  async create(cardId: string): Promise<NewSession> {
    const token = randomBytes(32).toString('base64url');
    const { rows } = await this.db.pool.query<{ expires_at: Date }>(
      `WITH gone AS (DELETE FROM sessions WHERE card_id = $2 AND expires_at <= now())
       INSERT INTO sessions (token_hash, card_id, expires_at) VALUES ($1, $2, now() + make_interval(hours => $3))
       RETURNING expires_at`,
      [hash(token), cardId, SESSION_HOURS],
    );
    return { token, expiresAt: rows[0].expires_at };
  }

  /** The card for a live session whose login is still ACTIVE, so locking a card signs it out everywhere. */
  async cardFor(token: string): Promise<string | null> {
    const { rows } = await this.db.pool.query<{ card_id: string }>(
      `SELECT s.card_id FROM sessions s JOIN auth a USING (card_id)
       WHERE s.token_hash = $1 AND s.expires_at > now() AND a.status = 'ACTIVE'`,
      [hash(token)],
    );
    return rows[0]?.card_id ?? null;
  }

  async revoke(token: string): Promise<void> {
    await this.db.pool.query('DELETE FROM sessions WHERE token_hash = $1', [hash(token)]);
  }
}
