import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { RecipientsRepository } from '../../repositories/recipients.repository';
import type { RecipientDto } from '../../types/recipients.types';
import { SaveRecipientCommand } from '../commands/save-recipient.command';

@CommandHandler(SaveRecipientCommand)
export class SaveRecipientHandler implements ICommandHandler<SaveRecipientCommand> {
  constructor(private readonly repo: RecipientsRepository) {}

  execute({ cardId, bankCode, account, name }: SaveRecipientCommand): Promise<RecipientDto> {
    return this.repo.save(cardId, bankCode, account, name);
  }
}
