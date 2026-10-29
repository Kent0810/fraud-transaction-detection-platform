import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import type { StaffAudit } from '../../../shared/prisma/audit';
import { CardsRepository } from '../../cards/repositories/cards.repository';
import { ControlsRepository } from '../../controls/repositories/controls.repository';
import { CardholderFilesRepository } from '../repositories/cardholder-files.repository';
import type { CardViewDto } from '../types/ops.types';

// A command, not a query: opening a card writes VIEW_CARDHOLDER to the audit log.
export class OpenCardCommand extends Command<CardViewDto | null> {
  constructor(
    readonly cardId: string,
    readonly by: StaffAudit,
  ) {
    super();
  }
}

@CommandHandler(OpenCardCommand)
export class OpenCardHandler implements ICommandHandler<OpenCardCommand> {
  constructor(
    private readonly files: CardholderFilesRepository,
    private readonly cards: CardsRepository,
    private readonly controls: ControlsRepository,
  ) {}

  async execute({ cardId, by }: OpenCardCommand): Promise<CardViewDto | null> {
    const file = await this.files.open(cardId, by);
    if (!file) return null;
    const [state, controls] = await Promise.all([this.cards.cardState(cardId), this.controls.forCard(cardId)]);
    return { cardId, ...file, state, controls };
  }
}
