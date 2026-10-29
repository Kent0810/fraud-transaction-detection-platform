import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import type { Config } from '../../../config';
import { CONFIG } from '../../../config.module';
import { KafkaService } from '../../../kafka/kafka.service';
import { SettleTransferCommand } from '../commands/settle-transfer.command';
import { TransferDecisionMessage } from '../types/transfers.types';

@Injectable()
export class TransferDecisionsConsumer implements OnApplicationBootstrap {
  private readonly log = new Logger(TransferDecisionsConsumer.name);

  constructor(
    private readonly kafka: KafkaService,
    private readonly commands: CommandBus,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.kafka.consume('cardholder-backend-transfers', this.cfg.transferDecisionsTopic, async (_, value) => {
      const decision = TransferDecisionMessage.safeParse(safeJson(value));
      if (!decision.success) {
        this.log.error(`skipping a malformed decision: ${value}`);
        return;
      }
      await this.commands.execute(new SettleTransferCommand(decision.data));
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
