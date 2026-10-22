import { Injectable } from '@nestjs/common';
import { types } from 'cassandra-driver';

import { CassandraService } from '../cassandra/cassandra.service';
import type { AlertDto, CardStateDto, TxnDto, Verdict } from './cards.types';

/**
 * Reads the Cassandra serving tables (filled by the Kafka Connect sink).
 * Every query stays inside one card's partition, as the schema was designed for.
 */
@Injectable()
export class CardsRepository {
  constructor(private readonly db: CassandraService) {}

  private run(query: string, params: unknown[]) {
    return this.db.client.execute(query, params, { prepare: true });
  }

  // A token-range scan over partitions. Fine for picking a demo card, not for production traffic.
  async cards(limit: number): Promise<string[]> {
    const rs = await this.run('SELECT DISTINCT card_id FROM txn_by_card LIMIT ?', [limit]);
    return rs.rows.map((r) => r.get('card_id'));
  }

  async transactions(cardId: string, limit: number): Promise<TxnDto[]> {
    const rs = await this.run('SELECT * FROM txn_by_card WHERE card_id = ? LIMIT ?', [cardId, limit]);
    return rs.rows.map(toTxn);
  }

  // txn_id is a clustering column after ts, so a lookup by txn_id alone needs ALLOW FILTERING.
  // That's fine here: it only scans this one card's partition (~160 rows over 90 days).
  async transaction(cardId: string, txnId: string): Promise<TxnDto | null> {
    const rs = await this.run('SELECT * FROM txn_by_card WHERE card_id = ? AND txn_id = ? ALLOW FILTERING', [
      cardId,
      txnId,
    ]);
    const row = rs.first();
    return row ? toTxn(row) : null;
  }

  async alerts(cardId: string, limit: number): Promise<AlertDto[]> {
    const [alerts, txns] = await Promise.all([
      this.run('SELECT * FROM alerts_by_card WHERE card_id = ? LIMIT ?', [cardId, limit]),
      // alerts_by_card has no merchant column: take it from the card's recent transactions.
      this.transactions(cardId, 500),
    ]);
    const merchants = new Map(txns.map((t) => [t.txnId, t.merchant]));
    return alerts.rows.map((r) => ({
      alertId: r.get('alert_id'),
      txnId: r.get('txn_id'),
      ruleId: r.get('rule_id'),
      ts: iso(r.get('ts')) ?? '',
      amount: num(r.get('amount')),
      merchant: merchants.get(r.get('txn_id')) ?? 'Unknown merchant',
      // Nothing writes status yet (see schema.cql), so a new alert is OPEN.
      status: r.get('status') ?? 'OPEN',
    }));
  }

  async cardState(cardId: string): Promise<CardStateDto | null> {
    const row = (await this.run('SELECT * FROM card_state WHERE card_id = ?', [cardId])).first();
    if (!row) return null;
    return {
      cardId: row.get('card_id'),
      riskScore: num(row.get('risk_score')),
      priority: num(row.get('priority')),
      amountSum: num(row.get('amount_sum')),
      openAlerts: row.get('open_alerts') ?? 0,
      lastDecision: row.get('last_decision'),
      updatedAt: iso(row.get('updated_at')),
    };
  }
}

function toTxn(r: types.Row): TxnDto {
  return {
    txnId: r.get('txn_id'),
    ts: iso(r.get('ts')) ?? '',
    merchant: r.get('merchant'),
    category: r.get('category'),
    amount: num(r.get('amount')),
    decision: (r.get('decision') as Verdict | null) ?? 'ALLOW',
    score: num(r.get('score')),
    firedRules: [...(r.get('fired_rules') ?? [])].sort(),
  };
}

function iso(ts: Date | null): string | null {
  return ts ? ts.toISOString() : null;
}

// `decimal` columns come back as BigDecimal; `double` as number.
function num(value: types.BigDecimal | number | null): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : value.toNumber();
}
