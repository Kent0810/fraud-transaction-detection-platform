import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { SessionsRepository } from '../../repositories/sessions.repository';
import { LogoutCommand } from '../commands/logout.command';

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(private readonly sessions: SessionsRepository) {}

  execute({ token }: LogoutCommand): Promise<void> {
    return this.sessions.revoke(token);
  }
}
