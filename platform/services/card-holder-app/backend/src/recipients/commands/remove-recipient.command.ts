import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { RecipientsRepository } from '../recipients.repository';

export class RemoveRecipientCommand extends Command<void> {
  constructor(
    readonly cardId: string,
    readonly bankCode: string,
    readonly account: string,
  ) {
    super();
  }
}

@CommandHandler(RemoveRecipientCommand)
export class RemoveRecipientHandler implements ICommandHandler<RemoveRecipientCommand> {
  constructor(private readonly repo: RecipientsRepository) {}

  execute({ cardId, bankCode, account }: RemoveRecipientCommand): Promise<void> {
    return this.repo.remove(cardId, bankCode, account);
  }
}
