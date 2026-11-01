import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { RecipientsRepository } from '../../repositories/recipients.repository';
import { RemoveRecipientCommand } from '../commands/remove-recipient.command';

@CommandHandler(RemoveRecipientCommand)
export class RemoveRecipientHandler implements ICommandHandler<RemoveRecipientCommand> {
  constructor(private readonly repo: RecipientsRepository) {}

  execute({ cardId, bankCode, account }: RemoveRecipientCommand): Promise<void> {
    return this.repo.remove(cardId, bankCode, account);
  }
}
