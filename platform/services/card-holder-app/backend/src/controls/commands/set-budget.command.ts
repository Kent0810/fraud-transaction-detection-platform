import { Inject } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import type { Config } from '../../config';
import { CONFIG } from '../../config.module';
import { KafkaService } from '../../kafka/kafka.service';
import { BUDGET_ID, type BudgetDto, controlEvent, type Period } from '../controls.types';

export class SetBudgetCommand extends Command<BudgetDto> {
  constructor(
    readonly cardId: string,
    readonly limit: number,
    readonly period: Period,
  ) {
    super();
  }
}

@CommandHandler(SetBudgetCommand)
export class SetBudgetHandler implements ICommandHandler<SetBudgetCommand> {
  constructor(
    private readonly kafka: KafkaService,
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
    await this.kafka.publish(this.cfg.controlTopic, cardId, event);
    return { limit, period, updatedAt: ts };
  }
}
