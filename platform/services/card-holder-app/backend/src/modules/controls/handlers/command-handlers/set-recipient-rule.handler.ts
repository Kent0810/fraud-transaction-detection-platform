import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import type { Config } from '../../../../config';
import { CONFIG } from '../../../../config.module';
import { auditEntry } from '../../../../shared/prisma/audit';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { controlEvent, type RecipientRuleDto, recipientControlId } from '../../types/controls.types';
import { SetRecipientRuleCommand } from '../commands/set-recipient-rule.command';

@CommandHandler(SetRecipientRuleCommand)
export class SetRecipientRuleHandler implements ICommandHandler<SetRecipientRuleCommand> {
  constructor(
    private readonly db: PrismaService,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  async execute({ cardId, recipient, type, by }: SetRecipientRuleCommand): Promise<RecipientRuleDto> {
    const ts = new Date().toISOString();
    const event = controlEvent('SET_RECIPIENT_RULE', recipientControlId(recipient.id), ts, {
      kind: 'RECIPIENT',
      recipient_id: recipient.id,
      recipient_name: recipient.name,
      rule: type,
      updated_at: ts,
    });
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
        data: auditEntry(by, type === 'BLOCK' ? 'BLOCK_RECIPIENT' : 'ALLOW_RECIPIENT', cardId, {
          recipient: recipient.id,
        }),
      }),
    ]);
    return { recipientId: recipient.id, name: recipient.name, type, createdAt: ts };
  }
}
