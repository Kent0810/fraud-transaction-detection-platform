import { Inject } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import type { Config } from '../../../config';
import { CONFIG } from '../../../config.module';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { BUDGET_ID, type BudgetDto, controlEvent, type Period } from '../types/controls.types';

export class SetBudgetCommand extends Command<BudgetDto> {
  constructor(
    readonly cardId: string,
    readonly limit: number,
    readonly period: Period,
  ) {
    super();
  }
}

// Through the outbox: Debezium publishes it to the control topic, keyed by card, as if it had been sent directly.
@CommandHandler(SetBudgetCommand)
export class SetBudgetHandler implements ICommandHandler<SetBudgetCommand> {
  constructor(
    private readonly db: PrismaService,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  async execute({ cardId, limit, period }: SetBudgetCommand): Promise<BudgetDto> {
    const ts = new Date().toISOString();
    const event = controlEvent('SET_BUDGET', BUDGET_ID, ts, {
      kind: 'BUDGET',
      budget_limit: limit,
      budget_period: period,
      updated_at: ts,
    });
    await this.db.client.outbox.createMany({
      data: {
        aggregate_type: this.cfg.controlTopic,
        aggregate_id: cardId,
        type: event.action,
        payload: event,
      },
    });
    return { limit, period, updatedAt: ts };
  }
}
