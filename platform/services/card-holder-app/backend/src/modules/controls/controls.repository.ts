import { Injectable } from '@nestjs/common';
import type { mapping } from 'cassandra-driver';

import { CassandraService } from '../../shared/cassandra/cassandra.service';
import { type ControlRow, iso, num } from '../../shared/cassandra/models';
import type { ControlsDto, MerchantRuleDto, Period, RuleType } from './controls.types';

@Injectable()
export class ControlsRepository {
  private readonly controls: mapping.ModelMapper<ControlRow>;

  constructor(db: CassandraService) {
    this.controls = db.mapper.forModel<ControlRow>('Control');
  }

  async forCard(cardId: string): Promise<ControlsDto> {
    const rows = (await this.controls.find({ cardId })).toArray();
    const budget = rows.find((r) => r.kind === 'BUDGET');
    const merchantRules: MerchantRuleDto[] = rows
      .filter((r) => r.kind === 'MERCHANT' && r.merchant && r.rule)
      .map((r) => ({ merchant: r.merchant as string, type: r.rule as RuleType, createdAt: iso(r.updatedAt) ?? '' }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      budget: budget
        ? { limit: num(budget.budgetLimit), period: budget.budgetPeriod as Period, updatedAt: iso(budget.updatedAt) }
        : null,
      merchantRules,
    };
  }
}
