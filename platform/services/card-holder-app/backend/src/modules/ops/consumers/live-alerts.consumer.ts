import { hostname } from 'node:os';

import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { type Observable, Subject } from 'rxjs';

import type { Config } from '../../../config';
import { CONFIG } from '../../../config.module';
import { KafkaService } from '../../../kafka/kafka.service';
import { DecisionMessage, type LiveAlertDto } from '../types/live-alert.types';

/**
 * Every flagged card payment (STEP_UP or DECLINE) as it is decided, for the console's live feed. A group of its own per
 * process, starting at the latest offset: each backend instance sees every decision, and nothing old is replayed.
 */
@Injectable()
export class LiveAlertsConsumer implements OnApplicationBootstrap {
  private readonly log = new Logger(LiveAlertsConsumer.name);
  private readonly alerts = new Subject<LiveAlertDto>();

  constructor(
    private readonly kafka: KafkaService,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  get stream(): Observable<LiveAlertDto> {
    return this.alerts.asObservable();
  }

  async onApplicationBootstrap(): Promise<void> {
    const group = `ops-console-live-${hostname()}-${process.pid}`;
    await this.kafka.consume(
      group,
      this.cfg.decisionsTopic,
      async (_, value) => {
        const d = DecisionMessage.safeParse(safeJson(value));
        if (!d.success) {
          this.log.error(`skipping a malformed decision: ${value}`);
          return;
        }
        if (d.data.decision === 'ALLOW') return;
        this.alerts.next({
          txnId: d.data.txn_id,
          cardId: d.data.card_id,
          ts: d.data.ts,
          merchant: d.data.merchant,
          category: d.data.category,
          amount: d.data.amount,
          currency: d.data.currency ?? 'VND',
          decision: d.data.decision,
          score: d.data.score,
          firedRules: d.data.fired_rules,
        });
      },
      false,
    );
  }
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
