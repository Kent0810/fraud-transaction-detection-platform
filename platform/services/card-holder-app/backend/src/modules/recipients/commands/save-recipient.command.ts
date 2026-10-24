import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { RecipientsRepository } from '../recipients.repository';
import type { RecipientDto } from '../recipients.types';

export class SaveRecipientCommand extends Command<RecipientDto> {
  constructor(
    readonly cardId: string,
    readonly bankCode: string,
    readonly account: string,
    readonly name: string,
  ) {
    super();
  }
}

@CommandHandler(SaveRecipientCommand)
export class SaveRecipientHandler implements ICommandHandler<SaveRecipientCommand> {
  constructor(private readonly repo: RecipientsRepository) {}

  execute({ cardId, bankCode, account, name }: SaveRecipientCommand): Promise<RecipientDto> {
    return this.repo.save(cardId, bankCode, account, name);
  }
}
