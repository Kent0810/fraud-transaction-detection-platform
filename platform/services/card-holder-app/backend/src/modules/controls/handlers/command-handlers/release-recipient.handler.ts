import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import type { Config } from '../../../../config';
import { CONFIG } from '../../../../config.module';
import { auditEntry } from '../../../../shared/prisma/audit';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { controlEvent, recipientControlId } from '../../types/controls.types';
import { ReleaseRecipientCommand } from '../commands/release-recipient.command';

@CommandHandler(ReleaseRecipientCommand)
export class ReleaseRecipientHandler implements ICommandHandler<ReleaseRecipientCommand> {
  constructor(
    private readonly db: PrismaService,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  async execute({ cardId, recipientId, by }: ReleaseRecipientCommand): Promise<void> {
    const event = controlEvent('RELEASE_RECIPIENT', recipientControlId(recipientId), new Date().toISOString());
    await this.db.client.$transaction([
      this.db.client.outbox.createMany({
        data: {
          aggregate_type: this.cfg.controlTopic,
          aggregate_id: cardId,
          type: event.action,
          payload: event,
        },
      }),
      this.db.client.audit_log.createMany({
        data: auditEntry(by, 'RELEASE_RECIPIENT', cardId, { recipient: recipientId }),
      }),
    ]);
  }
}
