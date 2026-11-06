import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { ControlsRepository } from '../../../controls/repositories/controls.repository';
import { CardholderFilesRepository } from '../../repositories/cardholder-files.repository';
import { CasesRepository } from '../../repositories/cases.repository';
import type { CardViewDto } from '../../types/ops.types';
import { OpenCardCommand } from '../commands/open-card.command';

@CommandHandler(OpenCardCommand)
export class OpenCardHandler implements ICommandHandler<OpenCardCommand> {
  constructor(
    private readonly files: CardholderFilesRepository,
    private readonly cases: CasesRepository,
    private readonly controls: ControlsRepository,
  ) {}

  async execute({ cardId, by }: OpenCardCommand): Promise<CardViewDto | null> {
    const file = await this.files.open(cardId, by);
    if (!file) return null;
    const [state, controls] = await Promise.all([this.cases.caseFor(cardId), this.controls.forCard(cardId)]);
    return { cardId, ...file, state, controls };
  }
}
