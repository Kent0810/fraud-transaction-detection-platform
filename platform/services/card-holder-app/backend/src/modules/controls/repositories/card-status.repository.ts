import { Inject, Injectable } from '@nestjs/common';
import { declineHeld, type Prisma } from '@platform/db';

import type { Config } from '../../../config';
import { CONFIG } from '../../../config.module';
import { auditEntry, type StaffAudit } from '../../../shared/prisma/audit';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { type CardStatusDto, controlEvent, FREEZE_ID } from '../types/controls.types';

// Read from Postgres, not Cassandra: a freeze must show, and block transfers, the moment it is saved.
@Injectable()
export class CardStatusRepository {
  constructor(
    private readonly db: PrismaService,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  async forCard(cardId: string): Promise<CardStatusDto> {
    const account = await this.db.client.accounts.findUnique({
      where: { card_id: cardId },
      select: { status: true },
    });
    return { frozen: account?.status === 'FROZEN' };
  }

  /**
   * Saves the account's new status and its control event in one transaction; Debezium publishes the event to the
   * control topic, where the fraud detector declines a frozen card's payments. A change from the console is audited in
   * the same transaction. Nothing is written when the status doesn't change.
   */
  async setFrozen(cardId: string, frozen: boolean, by?: StaffAudit): Promise<CardStatusDto> {
    await this.db.client.$transaction((tx) => this.applyFrozen(tx, cardId, frozen, by));
    return this.forCard(cardId);
  }

  /** The same change inside a caller's transaction, for when it has to succeed or fail along with something else. */
  async applyFrozen(tx: Prisma.TransactionClient, cardId: string, frozen: boolean, by?: StaffAudit): Promise<void> {
    const ts = new Date().toISOString();
    // Unfreeze carries no fields, so the Cassandra sink deletes the card's freeze row (as for a released recipient).
    const event = frozen
      ? controlEvent('FREEZE_CARD', FREEZE_ID, ts, { kind: 'FREEZE', updated_at: ts })
      : controlEvent('UNFREEZE_CARD', FREEZE_ID, ts);

    const changed = await tx.accounts.updateMany({
      where: {
        card_id: cardId,
        status: frozen ? 'ACTIVE' : 'FROZEN',
      },
      data: { status: frozen ? 'FROZEN' : 'ACTIVE' },
    });
    if (changed.count === 0) return;
    // A frozen card can't send money: anything held for an agent is declined now, and its money is free again.
    if (frozen) await declineHeld(tx, cardId);
    await tx.outbox.createMany({
      data: {
        aggregate_type: this.cfg.controlTopic,
        aggregate_id: cardId,
        type: event.action,
        payload: event,
      },
    });
    if (by) await tx.audit_log.createMany({ data: auditEntry(by, frozen ? 'FREEZE_CARD' : 'UNFREEZE_CARD', cardId) });
  }
}
