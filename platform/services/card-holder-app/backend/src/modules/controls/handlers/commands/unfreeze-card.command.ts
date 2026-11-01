import { Command } from '@nestjs/cqrs';

import type { CardStatusDto } from '../../types/controls.types';

// Unfreezing lets money move again, so it asks for the password: someone holding the unlocked phone can't undo it.
export class UnfreezeCardCommand extends Command<CardStatusDto> {
  constructor(
    readonly cardId: string,
    readonly password: string,
  ) {
    super();
  }
}
