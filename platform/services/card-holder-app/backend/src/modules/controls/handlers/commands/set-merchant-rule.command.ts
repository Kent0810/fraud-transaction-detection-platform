import { Command } from '@nestjs/cqrs';

import { type StaffAudit } from '../../../../shared/prisma/audit';
import { type MerchantRuleDto, type RuleType } from '../../types/controls.types';

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
