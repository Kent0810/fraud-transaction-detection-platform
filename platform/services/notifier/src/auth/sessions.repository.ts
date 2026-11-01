import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

const hash = (token: string) => createHash('sha256').update(token).digest();

@Injectable()
export class SessionsRepository {
  constructor(private readonly db: PrismaService) {}

  async cardFor(token: string): Promise<string | null> {
    const row = await this.db.client.sessions.findFirst({
      where: {
        token_hash: hash(token),
        expires_at: { gt: new Date() },
        cardholders: { auth: { status: 'ACTIVE' } },
      },
      select: { card_id: true },
    });
    return row?.card_id ?? null;
  }

  async isStaff(token: string): Promise<boolean> {
    const row = await this.db.client.staff_sessions.findFirst({
      where: { token_hash: hash(token), expires_at: { gt: new Date() }, staff: { active: true } },
      select: { staff_id: true },
    });
    return !!row;
  }
}
