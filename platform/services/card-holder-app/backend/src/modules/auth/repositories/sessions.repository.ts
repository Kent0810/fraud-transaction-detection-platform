import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../shared/prisma/prisma.service';

// Absolute lifetime; the app signs in again after this.
const SESSION_HOURS = 12;

const hash = (token: string) => createHash('sha256').update(token).digest();

export type NewSession = { token: string; expiresAt: Date };

@Injectable()
export class SessionsRepository {
  constructor(private readonly db: PrismaService) {}

  /** 256 random bits; only the hash is stored. Also clears this card's expired sessions. */
  async create(cardId: string): Promise<NewSession> {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_HOURS * 3_600_000);
    await this.db.client.$transaction([
      this.db.client.sessions.deleteMany({
        where: {
          card_id: cardId,
          expires_at: { lte: now },
        },
      }),
      this.db.client.sessions.create({
        data: {
          token_hash: hash(token),
          card_id: cardId,
          expires_at: expiresAt,
        },
        select: { card_id: true },
      }),
    ]);
    return { token, expiresAt };
  }

  /** The card for a live session whose login is still ACTIVE, so locking a card signs it out everywhere. */
  async cardFor(token: string): Promise<string | null> {
    const row = await this.db.client.sessions.findFirst({
      where: {
        token_hash: hash(token),
        expires_at: { gt: new Date() },
        cardholders: {
          auth: { status: 'ACTIVE' },
        },
      },
      select: { card_id: true },
    });
    return row?.card_id ?? null;
  }

  async revoke(token: string): Promise<void> {
    await this.db.client.sessions.deleteMany({ where: { token_hash: hash(token) } });
  }
}
