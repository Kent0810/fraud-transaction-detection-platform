import { Command } from '@nestjs/cqrs';

import type { CardStatusDto } from '../../types/controls.types';

// No password: freezing only stops money moving, and must be one tap for a lost card.
export class FreezeCardCommand extends Command<CardStatusDto> {
  constructor(readonly cardId: string) {
    super();
  }
}
