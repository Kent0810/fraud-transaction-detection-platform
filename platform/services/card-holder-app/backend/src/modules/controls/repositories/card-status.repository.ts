import { Inject, Injectable } from '@nestjs/common';

import type { Config } from '../../../config';
import { CONFIG } from '../../../config.module';
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
   * control topic, where the fraud detector declines a frozen card's payments. Nothing is written when the status
   * doesn't change.
   */
  async setFrozen(cardId: string, frozen: boolean): Promise<CardStatusDto> {
    const ts = new Date().toISOString();
    // Unfreeze carries no fields, so the Cassandra sink deletes the card's freeze row (as for a released merchant).
    const event = frozen
      ? controlEvent('FREEZE_CARD', FREEZE_ID, ts, { kind: 'FREEZE', updated_at: ts })
      : controlEvent('UNFREEZE_CARD', FREEZE_ID, ts);

    await this.db.client.$transaction(async (tx) => {
      const changed = await tx.accounts.updateMany({
        where: {
          card_id: cardId,
          status: frozen ? 'ACTIVE' : 'FROZEN',
        },
        data: { status: frozen ? 'FROZEN' : 'ACTIVE' },
      });
      if (changed.count === 0) return;
      await tx.outbox.createMany({
        data: {
          aggregate_type: this.cfg.controlTopic,
          aggregate_id: cardId,
          type: event.action,
          payload: event,
        },
      });
    });
    return this.forCard(cardId);
  }
}
