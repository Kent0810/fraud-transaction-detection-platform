import { Injectable } from '@nestjs/common';
import { mapping } from 'cassandra-driver';

import { CassandraService } from '../../../shared/cassandra/cassandra.service';
import { type AlertRow, iso, num, type TriageRow } from '../../../shared/cassandra/models';
import { CardsRepository } from '../../cards/repositories/cards.repository';
import type { Verdict } from '../../cards/types/cards.types';
import type { ActivityDto, CaseAlertDto, FlaggedPaymentDto, QueueItemDto, ReviewStatus } from '../types/ops.types';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

// Trends read each card in the queue separately (txn_by_card is split by card), so the number of cards is capped.
const TREND_CARDS = 500;

const bucket = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class CasesRepository {
  private readonly triage: mapping.ModelMapper<TriageRow>;
  private readonly alerts: mapping.ModelMapper<AlertRow>;

  constructor(
    db: CassandraService,
    private readonly cards: CardsRepository,
  ) {
    this.triage = db.mapper.forModel<TriageRow>('Triage');
    this.alerts = db.mapper.forModel<AlertRow>('Alert');
  }

  /** Today's and yesterday's partitions (the table keeps two days), one row per card, highest priority first. */
  async queue(limit: number): Promise<QueueItemDto[]> {
    const now = new Date();
    const days = [bucket(now), bucket(new Date(now.getTime() - DAY_MS))];
    const rows = (await Promise.all(days.map((b) => this.triage.find({ bucket: b })))).flatMap((r) => r.toArray());

    const latest = new Map<string, TriageRow>();
    for (const row of rows) {
      const seen = latest.get(row.cardId);
      if (!seen || (row.updatedAt?.getTime() ?? 0) > (seen.updatedAt?.getTime() ?? 0)) latest.set(row.cardId, row);
    }
    return [...latest.values()]
      .map((r) => ({
        cardId: r.cardId,
        priority: num(r.priority),
        riskScore: num(r.riskScore),
        amountSum: num(r.amountSum),
        openAlerts: r.openAlerts ?? 0,
        lastDecision: r.lastDecision as Verdict | null,
        updatedAt: iso(r.updatedAt),
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);
  }

  /**
   * Payments that went on a case in the last hours, across cards. Any such card is in today's or yesterday's queue
   * partition, so the queue finds the cards. The same test as the fraud detector's Decision.needsReview.
   */
  async flaggedPayments(hours: number): Promise<FlaggedPaymentDto[]> {
    const since = new Date(Date.now() - hours * HOUR_MS);
    const cards = await this.queue(TREND_CARDS);
    const txns = await Promise.all(cards.map((c) => this.cards.transactionsSince(c.cardId, since, 1000)));
    return cards.flatMap((c, i) =>
      txns[i]
        .filter((t) => isFlagged(t.decision, t.firedRules))
        .map((t) => ({
          txnId: t.txnId,
          cardId: c.cardId,
          ts: t.ts,
          decision: t.decision,
          firedRules: t.firedRules,
        })),
    );
  }

  /** The card's transactions and alerts since the given day, merged on txn_id. */
  async activity(cardId: string, days: number): Promise<ActivityDto[]> {
    const since = new Date(Date.now() - days * DAY_MS);
    const [txns, alerts] = await Promise.all([
      this.cards.transactionsSince(cardId, since, 1000),
      this.alertsSince(cardId, since),
    ]);
    const byTxn = new Map<string, CaseAlertDto[]>();
    for (const a of alerts) {
      byTxn.set(a.txnId, [...(byTxn.get(a.txnId) ?? []), toAlert(a)]);
    }
    return txns.map((t) => ({ ...t, alerts: byTxn.get(t.txnId) ?? [] }));
  }

  async alert(cardId: string, ts: Date, alertId: string): Promise<AlertRow | null> {
    return this.alerts.get({ cardId, ts, alertId });
  }

  /** All of one transaction's alerts: they share its ts, though another transaction could too. */
  async clearTransactionAlerts(cardId: string, ts: Date, txnId: string): Promise<void> {
    const rows = (await this.alerts.find({ cardId, ts })).toArray();
    await Promise.all(
      rows
        .filter((r) => r.txnId === txnId && r.status !== 'CLEARED')
        .map((r) => this.setAlertStatus(cardId, ts, r.alertId, 'CLEARED')),
    );
  }

  /** All of one transaction's alerts, confirmed as fraud: an agent rejected the held transfer. */
  async confirmTransactionAlerts(cardId: string, ts: Date, txnId: string): Promise<void> {
    const rows = (await this.alerts.find({ cardId, ts })).toArray();
    await Promise.all(
      rows
        .filter((r) => r.txnId === txnId && r.status !== 'CONFIRMED')
        .map((r) => this.setAlertStatus(cardId, ts, r.alertId, 'CONFIRMED')),
    );
  }

  async setAlertStatus(cardId: string, ts: Date, alertId: string, status: ReviewStatus): Promise<void> {
    await this.alerts.update({ cardId, ts, alertId, status }, { ifExists: true });
  }

  private async alertsSince(cardId: string, since: Date): Promise<AlertRow[]> {
    const rows = await this.alerts.find({ cardId, ts: mapping.q.gte(since) }, { limit: 1000 });
    return rows.toArray();
  }
}

function isFlagged(decision: Verdict, firedRules: string[]): boolean {
  if (firedRules.includes('FRAUD_RECIPIENT')) return true;
  return decision !== 'ALLOW' && firedRules.some((r) => r !== 'BLOCKED_RECIPIENT');
}

function toAlert(r: AlertRow): CaseAlertDto {
  return {
    alertId: r.alertId,
    ruleId: r.ruleId,
    ts: iso(r.ts) ?? '',
    score: num(r.score),
    status: (r.status as ReviewStatus | null) ?? 'OPEN',
  };
}
