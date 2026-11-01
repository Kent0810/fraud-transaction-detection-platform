import { Command } from '@nestjs/cqrs';

import type { RecipientDto } from '../../types/recipients.types';

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
