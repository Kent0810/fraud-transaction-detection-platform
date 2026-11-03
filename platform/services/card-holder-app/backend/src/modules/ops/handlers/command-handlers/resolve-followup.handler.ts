import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { auditEntry } from '../../../../shared/prisma/audit';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { CardStatusRepository } from '../../../controls/repositories/card-status.repository';
import { CasesRepository } from '../../repositories/cases.repository';
import { FollowupsRepository } from '../../repositories/followups.repository';
import { ResolveFollowupCommand } from '../commands/resolve-followup.command';

/**
 * How the agent's call went.
 *   GENUINE: the cardholder made the payment, so the analyst's fraud finding is discarded and its alerts close as cleared.
 *   FRAUD: they didn't, so their card is frozen and the recipient is marked as fraud for the whole bank.
 * Postgres first, then Cassandra, like an alert review: repeating the same outcome finishes the Cassandra half.
 */
@CommandHandler(ResolveFollowupCommand)
export class ResolveFollowupHandler implements ICommandHandler<ResolveFollowupCommand> {
  constructor(
    private readonly db: PrismaService,
    private readonly cards: CardStatusRepository,
    private readonly cases: CasesRepository,
    private readonly followups: FollowupsRepository,
  ) {}

  async execute({ cardId, txnId, outcome, by }: ResolveFollowupCommand): Promise<void> {
    const followup = await this.db.client.fraud_followups.findUnique({
      where: { card_id_txn_id: { card_id: cardId, txn_id: txnId } },
    });
    if (!followup) throw new NotFoundException('follow-up not found');
    if (followup.status !== 'PENDING' && followup.status !== outcome) {
      throw new ConflictException(`this follow-up is already closed as ${followup.status}`);
    }

    if (followup.status === 'PENDING') {
      await this.db.client.$transaction(async (tx) => {
        const changed = await tx.fraud_followups.updateMany({
          where: { card_id: cardId, txn_id: txnId, status: 'PENDING' },
          data: { status: outcome, resolved_by: by.staffId, resolved_at: new Date(), note: by.reason },
        });
        if (changed.count === 0) throw new ConflictException('this follow-up was just closed by someone else');
        await tx.audit_log.createMany({
          data: auditEntry(by, outcome === 'FRAUD' ? 'CUSTOMER_FRAUD' : 'CUSTOMER_GENUINE', cardId, {
            txnId,
            recipient: followup.recipient_id,
          }),
        });
        if (outcome === 'FRAUD') {
          await this.cards.applyFrozen(tx, cardId, true, by);
          await this.followups.mark(
            tx,
            { id: followup.recipient_id, name: followup.recipient_name },
            { cardId, txnId, staffId: by.staffId },
          );
        }
      });
    }

    if (outcome === 'GENUINE') await this.cases.clearTransactionAlerts(cardId, followup.txn_ts, txnId);
  }
}
