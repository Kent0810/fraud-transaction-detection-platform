import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import type { Config } from '../../../config';
import { CONFIG } from '../../../config.module';
import { KafkaService } from '../../../kafka/kafka.service';
import { SettleCommand } from '../commands/settle.command';
import { DecisionMessage } from '../types/transfers.types';

// Posts every decision, card payment or transfer, to the ledger. A throw redelivers the message; settle is repeatable.
@Injectable()
export class SettleConsumer implements OnApplicationBootstrap {
  private readonly log = new Logger(SettleConsumer.name);

  constructor(
    private readonly kafka: KafkaService,
    private readonly commands: CommandBus,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.kafka.consume('cardholder-backend-settle', this.cfg.decisionsTopic, async (_, value) => {
      const decision = DecisionMessage.safeParse(safeJson(value));
      if (!decision.success) {
        this.log.error(`skipping a malformed decision: ${value}`);
        return;
      }
      await this.commands.execute(new SettleCommand(decision.data));
    });
  }
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
