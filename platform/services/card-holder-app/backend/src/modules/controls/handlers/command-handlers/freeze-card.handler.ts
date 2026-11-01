import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CardStatusRepository } from '../../repositories/card-status.repository';
import type { CardStatusDto } from '../../types/controls.types';
import { FreezeCardCommand } from '../commands/freeze-card.command';

@CommandHandler(FreezeCardCommand)
export class FreezeCardHandler implements ICommandHandler<FreezeCardCommand> {
  constructor(private readonly repo: CardStatusRepository) {}

  execute({ cardId }: FreezeCardCommand): Promise<CardStatusDto> {
    return this.repo.setFrozen(cardId, true);
  }
}
