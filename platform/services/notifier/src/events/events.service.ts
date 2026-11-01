import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { filter, map, type Observable, Subject } from 'rxjs';
import type { z } from 'zod';

import type { Config } from '../config';
import { CONFIG } from '../config.module';
import { KafkaService } from '../kafka/kafka.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AlertMessage,
  type CardNoticeDto,
  CreditMessage,
  DecisionMessage,
  type LiveAlertDto,
  SettlementMessage,
} from './event.types';

const ALERT_ONLY_RULES = new Set(['MOCK_REPEAT']);

@Injectable()
export class EventsService implements OnApplicationBootstrap {
  private readonly log = new Logger(EventsService.name);
  private readonly ops = new Subject<LiveAlertDto>();
  private readonly cards = new Subject<{ cardId: string; notice: CardNoticeDto }>();

  constructor(
    private readonly kafka: KafkaService,
    private readonly db: PrismaService,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  get opsFeed(): Observable<LiveAlertDto> {
    return this.ops.asObservable();
  }

  cardFeed(cardId: string): Observable<CardNoticeDto> {
    return this.cards.pipe(
      filter((e) => e.cardId === cardId),
      map((e) => e.notice),
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    await Promise.all([
      this.kafka.follow(
        this.cfg.decisionsTopic,
        this.parsed(DecisionMessage, 'decision', (d) => this.onDecision(d)),
      ),
      this.kafka.follow(
        this.cfg.alertsTopic,
        this.parsed(AlertMessage, 'alert', (a) => this.onAlert(a)),
      ),
      this.kafka.follow(
        this.cfg.settlementsTopic,
        this.parsed(SettlementMessage, 'settlement', (s) => this.onSettlement(s)),
      ),
      this.kafka.follow(
        this.cfg.creditsTopic,
        this.parsed(CreditMessage, 'credit', (c) => this.onCredit(c)),
      ),
    ]);
  }

  private onDecision(d: z.infer<typeof DecisionMessage>): Promise<void> {
    if (d.decision === 'ALLOW') return Promise.resolve();
    this.ops.next({
      txnId: d.txn_id,
      cardId: d.card_id,
      ts: d.ts,
      merchant: d.merchant,
      category: d.category,
      amount: d.amount,
      currency: d.currency ?? 'VND',
      decision: d.decision,
      score: d.score,
      firedRules: d.fired_rules,
    });
    return Promise.resolve();
  }

  private async onAlert(a: z.infer<typeof AlertMessage>): Promise<void> {
    if (!ALERT_ONLY_RULES.has(a.rule_id)) return;
    const t = await this.counterparty(a.txn_id);
    this.ops.next({
      txnId: a.txn_id,
      cardId: a.card_id,
      ts: a.ts,
      merchant: t.name,
      category: t.channel === 'TRANSFER' ? 'transfer' : t.category,
      amount: a.amount,
      currency: 'VND',
      decision: 'ALLOW',
      score: a.score,
      firedRules: [a.rule_id],
    });
    this.toCard(a.card_id, {
      kind: 'ALERT',
      txnId: a.txn_id,
      ts: a.ts,
      channel: t.channel,
      counterparty: t.name,
      amount: a.amount,
      reasons: [a.rule_id],
    });
  }

  private async onSettlement(s: z.infer<typeof SettlementMessage>): Promise<void> {
    const t = await this.counterparty(s.txn_id);
    this.toCard(s.cc_num, {
      kind: s.status,
      txnId: s.txn_id,
      ts: s.ts,
      channel: s.channel,
      counterparty: t.name,
      amount: s.amt,
      reasons: s.declined_for,
    });
  }

  private onCredit(c: z.infer<typeof CreditMessage>): Promise<void> {
    this.toCard(c.cc_num, {
      kind: 'RECEIVED',
      txnId: c.txn_id,
      ts: c.ts,
      channel: 'TRANSFER',
      counterparty: c.merchant,
      amount: c.amount,
      reasons: [],
    });
    return Promise.resolve();
  }

  private toCard(cardId: string, notice: CardNoticeDto): void {
    this.cards.next({ cardId, notice });
  }

  private async counterparty(txnId: string): Promise<{ name: string; channel: 'CARD' | 'TRANSFER'; category: string }> {
    const t = await this.db.client.transactions.findUnique({
      where: { txn_id: txnId },
      select: { channel: true, merchant: true, to_name: true, category: true },
    });
    const channel = t?.channel === 'TRANSFER' ? 'TRANSFER' : 'CARD';
    return {
      name: (channel === 'TRANSFER' ? t?.to_name : t?.merchant) ?? 'Unknown',
      channel,
      category: t?.category ?? '',
    };
  }

  private parsed<T>(schema: z.ZodType<T>, what: string, handle: (m: T) => Promise<void>) {
    return async (_key: string, value: string): Promise<void> => {
      let json: unknown;
      try {
        json = JSON.parse(value);
      } catch {
        json = undefined;
      }
      const m = schema.safeParse(json);
      if (!m.success) {
        this.log.error(`skipping a malformed ${what}: ${value}`);
        return;
      }
      await handle(m.data);
    };
  }
}
