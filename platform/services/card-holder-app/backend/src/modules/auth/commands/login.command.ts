import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import type { SessionDto } from '../types/auth.types';
import { CardholdersRepository, type LoginResult } from '../repositories/cardholders.repository';
import { SessionsRepository } from '../repositories/sessions.repository';

// A command, not a query: a successful login writes last_login_at and a session.
export type LoginOutcome = Exclude<LoginResult, { outcome: 'OK' }> | { outcome: 'OK'; session: SessionDto };

export class LoginCommand extends Command<LoginOutcome> {
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

  async execute({ cardId, password }: LoginCommand): Promise<LoginOutcome> {
    const result = await this.cardholders.login(cardId, password);
    if (result.outcome !== 'OK') return result;
    const { token, expiresAt } = await this.sessions.create(cardId);
    return {
      outcome: 'OK',
      session: { token, expiresAt: expiresAt.toISOString(), ...result.holder },
    };
  }
}
