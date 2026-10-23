import { Inject } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import type { Config } from '../../config';
import { CONFIG } from '../../config.module';
import { KafkaService } from '../../kafka/kafka.service';
import { controlEvent, merchantControlId } from '../controls.types';

export class ReleaseMerchantCommand extends Command<void> {
  constructor(
    readonly cardId: string,
    readonly merchant: string,
  ) {
    super();
  }
}

@CommandHandler(ReleaseMerchantCommand)
export class ReleaseMerchantHandler implements ICommandHandler<ReleaseMerchantCommand> {
  constructor(
    private readonly kafka: KafkaService,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  async execute({ cardId, merchant }: ReleaseMerchantCommand): Promise<void> {
    const event = controlEvent('RELEASE_MERCHANT', merchantControlId(merchant), new Date().toISOString());
    await this.kafka.publish(this.cfg.controlTopic, cardId, event);
  }
}
