import { Command } from '@nestjs/cqrs';

import { type BudgetDto, type Period } from '../../types/controls.types';

export class SetBudgetCommand extends Command<BudgetDto> {
  constructor(
    readonly cardId: string,
    readonly limit: number,
    readonly period: Period,
  ) {
    super();
  }
}
