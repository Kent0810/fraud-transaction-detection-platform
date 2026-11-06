import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { resolveHeld } from '@platform/db';

import { auditEntry } from '../../../../shared/prisma/audit';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { CardStatusRepository } from '../../../controls/repositories/card-status.repository';
import { CasesRepository } from '../../repositories/cases.repository';
import { FollowupsRepository } from '../../repositories/followups.repository';
import { HeldTransfersRepository, transferRecipient } from '../../repositories/held-transfers.repository';
import { ResolveHeldTransferCommand } from '../commands/resolve-held-transfer.command';

/**
 * An agent's answer on a held transfer, after asking the cardholder.
 *   CONFIRM ("yes, that was me"): the transfer posts and its alerts close as cleared.
 *   REJECT ("that wasn't me"): it is declined, the card is frozen and the recipient is marked as fraud bank-wide,
 *   in one transaction; its alerts close as confirmed.
 * Postgres first, then Cassandra, like a follow-up.
 */
@CommandHandler(ResolveHeldTransferCommand)
export class ResolveHeldTransferHandler implements ICommandHandler<ResolveHeldTransferCommand> {
  constructor(
    private readonly db: PrismaService,
    private readonly held: HeldTransfersRepository,
    private readonly cards: CardStatusRepository,
    private readonly cases: CasesRepository,
    private readonly followups: FollowupsRepository,
  ) {}

  async execute({ cardId, txnId, outcome, by }: ResolveHeldTransferCommand): Promise<void> {
    const txn = await this.held.find(cardId, txnId);
    if (!txn) throw new NotFoundException('transfer not found');
    const recipient = transferRecipient(txn);

    await this.db.client.$transaction(async (tx) => {
      const done = await resolveHeld(tx, cardId, txnId, outcome);
      if (!done) throw new ConflictException('this transfer is no longer waiting');
      await tx.audit_log.createMany({
        data: auditEntry(by, outcome === 'CONFIRM' ? 'CONFIRM_HELD_TRANSFER' : 'REJECT_HELD_TRANSFER', cardId, {
          txnId,
          recipient: recipient.id,
        }),
      });
      if (outcome === 'REJECT') {
        await this.cards.applyFrozen(tx, cardId, true, by);
        await this.followups.mark(tx, recipient, { cardId, txnId, staffId: by.staffId });
      }
    });

    if (outcome === 'CONFIRM') await this.cases.clearTransactionAlerts(cardId, txn.created_at, txnId);
    else await this.cases.confirmTransactionAlerts(cardId, txn.created_at, txnId);
  }
}
