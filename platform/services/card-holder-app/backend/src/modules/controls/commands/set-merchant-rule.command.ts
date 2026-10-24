import { Inject } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import type { Config } from '../../../config';
import { CONFIG } from '../../../config.module';
import { KafkaService } from '../../../kafka/kafka.service';
import { controlEvent, merchantControlId, type MerchantRuleDto, type RuleType } from '../controls.types';

export class SetMerchantRuleCommand extends Command<MerchantRuleDto> {
  constructor(
    readonly cardId: string,
    readonly merchant: string,
    readonly type: RuleType,
  ) {
    super();
  }
}

@CommandHandler(SetMerchantRuleCommand)
export class SetMerchantRuleHandler implements ICommandHandler<SetMerchantRuleCommand> {
  constructor(
    private readonly kafka: KafkaService,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  async execute({ cardId, merchant, type }: SetMerchantRuleCommand): Promise<MerchantRuleDto> {
    const ts = new Date().toISOString();
    const event = controlEvent('SET_MERCHANT_RULE', merchantControlId(merchant), ts, {
      kind: 'MERCHANT',
      merchant,
      rule: type,
      updated_at: ts,
    });
    await this.kafka.publish(this.cfg.controlTopic, cardId, event);
    return { merchant, type, createdAt: ts };
  }
}
