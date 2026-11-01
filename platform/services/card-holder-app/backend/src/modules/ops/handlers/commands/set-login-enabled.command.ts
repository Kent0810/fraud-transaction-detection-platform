import { Command } from '@nestjs/cqrs';

import type { StaffAudit } from '../../../../shared/prisma/audit';
import type { LoginStatus } from '../../types/ops.types';

export class SetLoginEnabledCommand extends Command<LoginStatus | null> {
  constructor(
    readonly cardId: string,
    readonly enabled: boolean,
    readonly by: StaffAudit,
  ) {
    super();
  }
}
