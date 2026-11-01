import { ForbiddenException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { verifyPassword } from '@platform/db';

import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { CardStatusRepository } from '../../repositories/card-status.repository';
import type { CardStatusDto } from '../../types/controls.types';
import { UnfreezeCardCommand } from '../commands/unfreeze-card.command';

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
