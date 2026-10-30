import { Injectable } from '@nestjs/common';

import { auditEntry, type StaffAudit } from '../../../shared/prisma/audit';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { LoginStatus } from '../types/ops.types';

@Injectable()
export class LoginsRepository {
  constructor(private readonly db: PrismaService) {}

  /**
   * Turns the cardholder's app sign-in off (DISABLED, and their open sessions end) or back on (ACTIVE, which also
   * unlocks a login LOCKED by wrong passwords). Audited in the same transaction; nothing is written when the status
   * doesn't change. Null for a card without a login.
   */
  async setEnabled(cardId: string, enabled: boolean, by: StaffAudit): Promise<LoginStatus | null> {
    return this.db.client.$transaction(async (tx) => {
      const changed = await tx.auth.updateMany({
        where: {
          card_id: cardId,
          status: enabled ? { not: 'ACTIVE' } : { not: 'DISABLED' },
        },
        data: {
          status: enabled ? 'ACTIVE' : 'DISABLED',
          failed_logins: 0,
        },
      });
      if (changed.count > 0) {
        if (!enabled) await tx.sessions.deleteMany({ where: { card_id: cardId } });
        await tx.audit_log.createMany({ data: auditEntry(by, enabled ? 'RESTORE_LOGIN' : 'DISABLE_LOGIN', cardId) });
      }
      const login = await tx.auth.findUnique({
        where: { card_id: cardId },
        select: { status: true },
      });
      return (login?.status as LoginStatus | undefined) ?? null;
    });
  }
}
