import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { SessionsRepository } from '../repositories/sessions.repository';

export class LogoutCommand extends Command<void> {
  constructor(readonly token: string) {
    super();
  }
}

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(private readonly sessions: SessionsRepository) {}

  execute({ token }: LogoutCommand): Promise<void> {
    return this.sessions.revoke(token);
  }
}
