import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

import type { StaffMember, StaffRole } from '../../../common/decorators/staff.decorator';
import { PrismaService } from '../../../shared/prisma/prisma.service';

// A working shift; staff sign in again after this.
const SESSION_HOURS = 10;

const NO_SUCH_LOGIN = bcrypt.hashSync('no such login', 8);

const hash = (token: string) => createHash('sha256').update(token).digest();

const SELECT_MEMBER = {
  staff_id: true,
  name: true,
  email: true,
  role: true,
} as const;

function toMember(row: { staff_id: number; name: string; email: string; role: string }): StaffMember {
  return {
    staffId: row.staff_id,
    name: row.name,
    email: row.email,
    role: row.role as StaffRole,
  };
}

@Injectable()
export class StaffRepository {
  constructor(private readonly db: PrismaService) {}

  async login(email: string, password: string): Promise<StaffMember | null> {
    const row = await this.db.client.staff.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: {
        ...SELECT_MEMBER,
        password_hash: true,
        active: true,
      },
    });
    const passwordOk = await bcrypt.compare(password, row?.password_hash ?? NO_SUCH_LOGIN);
    if (!row || !passwordOk || !row.active) return null;
    return toMember(row);
  }

  async createSession(staffId: number): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_HOURS * 3_600_000);
    await this.db.client.$transaction([
      this.db.client.staff_sessions.deleteMany({
        where: {
          staff_id: staffId,
          expires_at: { lte: now },
        },
      }),
      this.db.client.staff_sessions.createMany({
        data: {
          token_hash: hash(token),
          staff_id: staffId,
          expires_at: expiresAt,
        },
      }),
    ]);
    return { token, expiresAt };
  }

  async staffFor(token: string): Promise<StaffMember | null> {
    const row = await this.db.client.staff_sessions.findFirst({
      where: {
        token_hash: hash(token),
        expires_at: { gt: new Date() },
        staff: { active: true },
      },
      select: { staff: { select: SELECT_MEMBER } },
    });
    return row ? toMember(row.staff) : null;
  }

  async revoke(token: string): Promise<void> {
    await this.db.client.staff_sessions.deleteMany({ where: { token_hash: hash(token) } });
  }
}
