import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import type { StaffAudit } from '../../../shared/prisma/audit';
import { LoginsRepository } from '../repositories/logins.repository';
import type { LoginStatus } from '../types/ops.types';

export class SetLoginEnabledCommand extends Command<LoginStatus | null> {
  constructor(
    readonly cardId: string,
    readonly enabled: boolean,
    readonly by: StaffAudit,
  ) {
    super();
  }
}

@CommandHandler(SetLoginEnabledCommand)
export class SetLoginEnabledHandler implements ICommandHandler<SetLoginEnabledCommand> {
  constructor(private readonly repo: LoginsRepository) {}

  execute({ cardId, enabled, by }: SetLoginEnabledCommand): Promise<LoginStatus | null> {
    return this.repo.setEnabled(cardId, enabled, by);
  }
}
