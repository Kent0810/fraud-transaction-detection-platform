import { Command } from '@nestjs/cqrs';

import { type LoginResult } from '../../repositories/cardholders.repository';
import type { SessionDto } from '../../types/auth.types';

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
