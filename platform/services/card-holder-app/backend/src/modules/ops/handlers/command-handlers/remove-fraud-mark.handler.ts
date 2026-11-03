import { NotFoundException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { auditEntry } from '../../../../shared/prisma/audit';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { FollowupsRepository } from '../../repositories/followups.repository';
import { RemoveFraudMarkCommand } from '../commands/remove-fraud-mark.command';

// New payments to the recipient stop being flagged; past alerts stay as they are for the record.
@CommandHandler(RemoveFraudMarkCommand)
export class RemoveFraudMarkHandler implements ICommandHandler<RemoveFraudMarkCommand> {
  constructor(
    private readonly db: PrismaService,
    private readonly followups: FollowupsRepository,
  ) {}

  async execute({ recipientId, by }: RemoveFraudMarkCommand): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      const mark = await tx.recipient_fraud_marks.findUnique({ where: { recipient_id: recipientId } });
      if (!mark) throw new NotFoundException('this recipient has no fraud mark');
      await tx.recipient_fraud_marks.delete({ where: { recipient_id: recipientId } });
      await this.followups.publish(tx, recipientId, false);
      // audit_log needs a card: the one whose call led to the mark.
      await tx.audit_log.createMany({
        data: auditEntry(by, 'REMOVE_FRAUD_MARK', mark.card_id, { recipient: recipientId }),
      });
    });
  }
}
