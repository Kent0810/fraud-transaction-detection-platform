import { hostname } from 'node:os';

import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { type Observable, Subject } from 'rxjs';

import type { Config } from '../../../config';
import { CONFIG } from '../../../config.module';
import { KafkaService } from '../../../kafka/kafka.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AlertMessage, DecisionMessage, type LiveAlertDto } from '../types/live-alert.types';

// Rules that raise an alert without touching the verdict, so their alerts never show in a STEP_UP or DECLINE decision.
// The detector's other rules alert too, but through the decision, which the feed already shows.
const ALERT_ONLY_RULES = new Set(['MOCK_REPEAT']);

/**
 * Every flagged card payment (STEP_UP or DECLINE) as it is decided, and every alert-only rule's alert, for the console's
 * live feed. Groups of their own per process, starting at the latest offset: each backend instance sees everything, and
 * nothing old is replayed.
 */
@Injectable()
export class LiveAlertsConsumer implements OnApplicationBootstrap {
  private readonly log = new Logger(LiveAlertsConsumer.name);
  private readonly alerts = new Subject<LiveAlertDto>();

  constructor(
    private readonly kafka: KafkaService,
    private readonly db: PrismaService,
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
    await this.kafka.consume(
      `${group}-alerts`,
      this.cfg.alertsTopic,
      async (_, value) => {
        const a = AlertMessage.safeParse(safeJson(value));
        if (!a.success) {
          this.log.error(`skipping a malformed alert: ${value}`);
          return;
        }
        if (!ALERT_ONLY_RULES.has(a.data.rule_id)) return;
        // The alert carries no merchant or recipient: the transaction in Postgres has them.
        const t = await this.db.client.transactions.findUnique({
          where: { txn_id: a.data.txn_id },
          select: { channel: true, merchant: true, to_name: true, category: true },
        });
        this.alerts.next({
          txnId: a.data.txn_id,
          cardId: a.data.card_id,
          ts: a.data.ts,
          merchant: (t?.channel === 'TRANSFER' ? t.to_name : t?.merchant) ?? 'Unknown',
          category: t?.channel === 'TRANSFER' ? 'transfer' : (t?.category ?? ''),
          amount: a.data.amount,
          currency: 'VND',
          decision: 'ALLOW',
          score: a.data.score,
          firedRules: [a.data.rule_id],
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
