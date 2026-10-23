import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import type { SessionDto } from '../auth.types';
import { CardholdersRepository } from '../cardholders.repository';

// A command, not a query: a successful login writes last_login_at.
export class LoginCommand extends Command<SessionDto | null> {
  constructor(
    readonly cardId: string,
    readonly password: string,
  ) {
    super();
  }
}

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(private readonly repo: CardholdersRepository) {}

  execute({ cardId, password }: LoginCommand): Promise<SessionDto | null> {
    return this.repo.login(cardId, password);
  }
}
