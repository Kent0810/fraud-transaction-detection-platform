import { Command } from '@nestjs/cqrs';

import { type StaffAudit } from '../../../../shared/prisma/audit';
import { type RecipientRuleDto, type RuleType } from '../../types/controls.types';
import { type Recipient } from '../../types/recipient';

export class SetRecipientRuleCommand extends Command<RecipientRuleDto> {
  constructor(
    readonly cardId: string,
    readonly recipient: Recipient,
    readonly type: RuleType,
    readonly by: StaffAudit,
  ) {
    super();
  }
}
