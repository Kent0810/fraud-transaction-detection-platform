import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CardStatusRepository } from '../../../controls/repositories/card-status.repository';
import type { CardStatusDto } from '../../../controls/types/controls.types';
import { SetCardFrozenCommand } from '../commands/set-card-frozen.command';

@CommandHandler(SetCardFrozenCommand)
export class SetCardFrozenHandler implements ICommandHandler<SetCardFrozenCommand> {
  constructor(private readonly repo: CardStatusRepository) {}

  execute({ cardId, frozen, by }: SetCardFrozenCommand): Promise<CardStatusDto> {
    return this.repo.setFrozen(cardId, frozen, by);
  }
}
