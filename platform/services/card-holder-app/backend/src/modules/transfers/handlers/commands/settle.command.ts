import { Command } from '@nestjs/cqrs';

import type { DecisionMessage } from '../../types/transfers.types';

// Applies the fraud detector's verdict to the ledger. Null when the card or transfer is unknown.
export class SettleCommand extends Command<boolean> {
  constructor(readonly decision: DecisionMessage) {
    super();
  }
}
