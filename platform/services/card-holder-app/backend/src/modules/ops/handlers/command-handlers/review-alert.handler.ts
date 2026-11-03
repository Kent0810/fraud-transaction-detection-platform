import { NotFoundException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { auditEntry } from '../../../../shared/prisma/audit';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { CardsRepository } from '../../../cards/repositories/cards.repository';
import { txnRecipient } from '../../../controls/types/recipient';
import { CasesRepository } from '../../repositories/cases.repository';
import { ReviewAlertCommand } from '../commands/review-alert.command';

// Audited in Postgres first, then marked in Cassandra: an update, so a retry is harmless.
// Confirming also opens the agents' follow-up: one per transaction, however many of its alerts get confirmed.
@CommandHandler(ReviewAlertCommand)
export class ReviewAlertHandler implements ICommandHandler<ReviewAlertCommand> {
  constructor(
    private readonly db: PrismaService,
    private readonly cases: CasesRepository,
    private readonly cards: CardsRepository,
  ) {}

  async execute({ cardId, alertId, ts, status, by }: ReviewAlertCommand): Promise<void> {
    const at = new Date(ts);
    const alert = await this.cases.alert(cardId, at, alertId);
    if (!alert) throw new NotFoundException('alert not found');

    if (status === 'CLEARED') {
      await this.db.client.audit_log.createMany({ data: auditEntry(by, 'CLEAR_ALERT', cardId, { alertId }) });
    } else {
      const txn = await this.cards.transaction(cardId, alert.txnId);
      if (!txn) throw new NotFoundException('the transaction for this alert was not found');
      const recipient = txnRecipient(txn);
      await this.db.client.$transaction([
        this.db.client.audit_log.createMany({ data: auditEntry(by, 'CONFIRM_ALERT', cardId, { alertId }) }),
        this.db.client.fraud_followups.createMany({
          data: {
            card_id: cardId,
            txn_id: alert.txnId,
            txn_ts: at,
            recipient_id: recipient.id,
            recipient_name: recipient.name,
            amount: BigInt(Math.round(txn.amount)),
            confirmed_by: by.staffId,
          },
          skipDuplicates: true,
        }),
      ]);
    }
    await this.cases.setAlertStatus(cardId, at, alertId, status);
  }
}
