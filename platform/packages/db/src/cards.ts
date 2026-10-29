import bcrypt from 'bcryptjs';

import type { PrismaClient } from './generated/prisma/client';

/** The card's own login password, checked again before anything that moves money or re-enables the card. */
export async function verifyPassword(db: PrismaClient, cardId: string, password: string): Promise<boolean> {
  const login = await db.auth.findUnique({
    where: { card_id: cardId },
    select: { password_hash: true },
  });
  return !!login && (await bcrypt.compare(password, login.password_hash));
}

export async function isCardFrozen(db: PrismaClient, cardId: string): Promise<boolean> {
  const account = await db.accounts.findUnique({
    where: { card_id: cardId },
    select: { status: true },
  });
  return account?.status === 'FROZEN';
}
