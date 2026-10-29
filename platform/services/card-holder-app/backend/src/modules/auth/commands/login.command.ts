import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import type { SessionDto } from '../types/auth.types';
import { CardholdersRepository } from '../repositories/cardholders.repository';
import { SessionsRepository } from '../repositories/sessions.repository';

// A command, not a query: a successful login writes last_login_at and a session.
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
  constructor(
    private readonly cardholders: CardholdersRepository,
    private readonly sessions: SessionsRepository,
  ) {}

  async execute({ cardId, password }: LoginCommand): Promise<SessionDto | null> {
    const holder = await this.cardholders.login(cardId, password);
    if (!holder) return null;
    const { token, expiresAt } = await this.sessions.create(cardId);
    return { token, expiresAt: expiresAt.toISOString(), ...holder };
  }
}
