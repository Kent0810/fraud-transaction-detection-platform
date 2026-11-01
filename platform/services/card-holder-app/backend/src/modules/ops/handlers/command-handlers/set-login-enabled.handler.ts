import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { LoginsRepository } from '../../repositories/logins.repository';
import type { LoginStatus } from '../../types/ops.types';
import { SetLoginEnabledCommand } from '../commands/set-login-enabled.command';

@CommandHandler(SetLoginEnabledCommand)
export class SetLoginEnabledHandler implements ICommandHandler<SetLoginEnabledCommand> {
  constructor(private readonly repo: LoginsRepository) {}

  execute({ cardId, enabled, by }: SetLoginEnabledCommand): Promise<LoginStatus | null> {
    return this.repo.setEnabled(cardId, enabled, by);
  }
}
