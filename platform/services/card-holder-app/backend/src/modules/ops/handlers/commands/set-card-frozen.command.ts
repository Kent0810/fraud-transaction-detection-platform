import { Command } from '@nestjs/cqrs';

import type { StaffAudit } from '../../../../shared/prisma/audit';
import type { CardStatusDto } from '../../../controls/types/controls.types';

// No password, unlike the app's unfreeze: the agent has checked who is calling.
export class SetCardFrozenCommand extends Command<CardStatusDto> {
  constructor(
    readonly cardId: string,
    readonly frozen: boolean,
    readonly by: StaffAudit,
  ) {
    super();
  }
}
