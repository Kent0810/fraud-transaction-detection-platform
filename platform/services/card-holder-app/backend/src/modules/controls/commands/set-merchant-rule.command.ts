import { Inject } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import type { Config } from '../../../config';
import { CONFIG } from '../../../config.module';
import { auditEntry, type StaffAudit } from '../../../shared/prisma/audit';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { controlEvent, merchantControlId, type MerchantRuleDto, type RuleType } from '../types/controls.types';

export class SetMerchantRuleCommand extends Command<MerchantRuleDto> {
  constructor(
    readonly cardId: string,
    readonly merchant: string,
    readonly type: RuleType,
    readonly by?: StaffAudit,
  ) {
    super();
  }
}

@CommandHandler(SetMerchantRuleCommand)
export class SetMerchantRuleHandler implements ICommandHandler<SetMerchantRuleCommand> {
  constructor(
    private readonly db: PrismaService,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  async execute({ cardId, merchant, type, by }: SetMerchantRuleCommand): Promise<MerchantRuleDto> {
    const ts = new Date().toISOString();
    const event = controlEvent('SET_MERCHANT_RULE', merchantControlId(merchant), ts, {
      kind: 'MERCHANT',
      merchant,
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
      ...(by
        ? [
            this.db.client.audit_log.createMany({
              data: auditEntry(by, type === 'BLOCK' ? 'BLOCK_MERCHANT' : 'ALLOW_MERCHANT', cardId, { merchant }),
            }),
          ]
        : []),
    ]);
    return { merchant, type, createdAt: ts };
  }
}
