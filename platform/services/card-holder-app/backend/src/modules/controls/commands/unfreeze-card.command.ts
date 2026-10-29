import { ForbiddenException } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { verifyPassword } from '@platform/db';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CardStatusRepository } from '../repositories/card-status.repository';
import type { CardStatusDto } from '../types/controls.types';

// Unfreezing lets money move again, so it asks for the password: someone holding the unlocked phone can't undo it.
export class UnfreezeCardCommand extends Command<CardStatusDto> {
  constructor(
    readonly cardId: string,
    readonly password: string,
  ) {
    super();
  }
}

@CommandHandler(UnfreezeCardCommand)
export class UnfreezeCardHandler implements ICommandHandler<UnfreezeCardCommand> {
  constructor(
    private readonly db: PrismaService,
    private readonly repo: CardStatusRepository,
  ) {}

  async execute({ cardId, password }: UnfreezeCardCommand): Promise<CardStatusDto> {
    // 403, not 401: the session is still valid and the app shouldn't sign out.
    if (!(await verifyPassword(this.db.client, cardId, password))) throw new ForbiddenException('incorrect password');
    return this.repo.setFrozen(cardId, false);
  }
}
