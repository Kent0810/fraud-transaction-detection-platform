import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@platform/db';

import type { Config } from '../../../config';
import { CONFIG } from '../../../config.module';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { Recipient } from '../../controls/types/recipient';
import type { FollowupDto, FollowupStatus, FraudMarkDto } from '../types/ops.types';

@Injectable()
export class FollowupsRepository {
  constructor(
    private readonly db: PrismaService,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  async recent(limit: number): Promise<FollowupDto[]> {
    const rows = await this.db.client.fraud_followups.findMany({
      orderBy: { confirmed_at: 'desc' },
      take: limit,
      include: {
        cardholders: { select: { first_name: true, last_name: true, email: true } },
        staff_fraud_followups_confirmed_byTostaff: { select: { name: true } },
        staff_fraud_followups_resolved_byTostaff: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      cardId: r.card_id,
      txnId: r.txn_id,
      ts: r.txn_ts.toISOString(),
      holderName: `${r.cardholders.first_name} ${r.cardholders.last_name}`,
      holderEmail: r.cardholders.email,
      recipientId: r.recipient_id,
      recipientName: r.recipient_name,
      amount: Number(r.amount),
      status: r.status as FollowupStatus,
      confirmedBy: r.staff_fraud_followups_confirmed_byTostaff.name,
      confirmedAt: r.confirmed_at.toISOString(),
      resolvedBy: r.staff_fraud_followups_resolved_byTostaff?.name ?? null,
      resolvedAt: r.resolved_at?.toISOString() ?? null,
      note: r.note,
    }));
  }

  async marks(limit: number): Promise<FraudMarkDto[]> {
    const rows = await this.db.client.recipient_fraud_marks.findMany({
      orderBy: { marked_at: 'desc' },
      take: limit,
      include: { staff: { select: { name: true } } },
    });
    return rows.map((r) => ({
      recipientId: r.recipient_id,
      recipientName: r.recipient_name,
      cardId: r.card_id,
      markedBy: r.staff.name,
      markedAt: r.marked_at.toISOString(),
    }));
  }

  /** Saves the mark and tells the fraud detector, in the caller's transaction. A second mark keeps the first's details. */
  async mark(
    tx: Prisma.TransactionClient,
    recipient: Recipient,
    from: { cardId: string; txnId: string; staffId: number },
  ): Promise<void> {
    await tx.recipient_fraud_marks.createMany({
      data: {
        recipient_id: recipient.id,
        recipient_name: recipient.name,
        card_id: from.cardId,
        txn_id: from.txnId,
        marked_by: from.staffId,
      },
      skipDuplicates: true,
    });
    await this.publish(tx, recipient.id, true);
  }

  /** The topic is compacted and an outbox row can't carry an empty value, so removal is an event, not a tombstone. */
  publish(tx: Prisma.TransactionClient, recipientId: string, active: boolean) {
    return tx.outbox.createMany({
      data: {
        aggregate_type: this.cfg.fraudMarksTopic,
        aggregate_id: recipientId,
        type: active ? 'RecipientMarkedAsFraud' : 'RecipientFraudMarkRemoved',
        payload: { recipient_id: recipientId, active },
      },
    });
  }
}
