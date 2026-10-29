import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import type { StaffAudit } from '../../../shared/prisma/audit';
import { CardStatusRepository } from '../../controls/repositories/card-status.repository';
import type { CardStatusDto } from '../../controls/types/controls.types';

// No password, unlike the app's unfreeze: the agent has checked who is calling.
export class SetCardFrozenCommand extends Command<CardStatusDto> {
  constructor(
    readonly cardId: string,
    readonly frozen: boolean,
    readonly by: StaffAudit,
  ) {
    super();
  }
}

@CommandHandler(SetCardFrozenCommand)
export class SetCardFrozenHandler implements ICommandHandler<SetCardFrozenCommand> {
  constructor(private readonly repo: CardStatusRepository) {}

  execute({ cardId, frozen, by }: SetCardFrozenCommand): Promise<CardStatusDto> {
    return this.repo.setFrozen(cardId, frozen, by);
  }
}
