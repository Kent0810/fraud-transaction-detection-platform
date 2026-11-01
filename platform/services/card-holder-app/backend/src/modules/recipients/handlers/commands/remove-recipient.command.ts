import { Command } from '@nestjs/cqrs';

export class RemoveRecipientCommand extends Command<void> {
  constructor(
    readonly cardId: string,
    readonly bankCode: string,
    readonly account: string,
  ) {
    super();
  }
}
