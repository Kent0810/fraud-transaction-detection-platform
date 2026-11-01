import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CardholdersRepository } from '../../repositories/cardholders.repository';
import { SessionsRepository } from '../../repositories/sessions.repository';
import { LoginCommand, type LoginOutcome } from '../commands/login.command';

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
