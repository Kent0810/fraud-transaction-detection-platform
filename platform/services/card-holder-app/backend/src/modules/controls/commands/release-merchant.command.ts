import { Inject } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import type { Config } from '../../../config';
import { CONFIG } from '../../../config.module';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { controlEvent, merchantControlId } from '../types/controls.types';

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
    private readonly db: PrismaService,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  async execute({ cardId, merchant }: ReleaseMerchantCommand): Promise<void> {
    const event = controlEvent('RELEASE_MERCHANT', merchantControlId(merchant), new Date().toISOString());
    await this.db.client.outbox.createMany({
      data: {
        aggregate_type: this.cfg.controlTopic,
        aggregate_id: cardId,
        type: event.action,
        payload: event,
      },
    });
  }
}
