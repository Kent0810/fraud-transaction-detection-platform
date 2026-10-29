import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CardStatusRepository } from '../repositories/card-status.repository';
import type { CardStatusDto } from '../types/controls.types';

// No password: freezing only stops money moving, and must be one tap for a lost card.
export class FreezeCardCommand extends Command<CardStatusDto> {
  constructor(readonly cardId: string) {
    super();
  }
}

@CommandHandler(FreezeCardCommand)
export class FreezeCardHandler implements ICommandHandler<FreezeCardCommand> {
  constructor(private readonly repo: CardStatusRepository) {}

  execute({ cardId }: FreezeCardCommand): Promise<CardStatusDto> {
    return this.repo.setFrozen(cardId, true);
  }
}
