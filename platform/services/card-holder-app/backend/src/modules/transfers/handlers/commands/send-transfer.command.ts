import { Command } from '@nestjs/cqrs';

import type { TransferDto, TransferRequest } from '../../types/transfers.types';

// The sender is the session's card, and the password is required even though the user is signed in:
// a stolen or unattended session alone can't move money.
export class SendTransferCommand extends Command<TransferDto> {
  constructor(
    readonly cardId: string,
    readonly request: TransferRequest,
  ) {
    super();
  }
}
