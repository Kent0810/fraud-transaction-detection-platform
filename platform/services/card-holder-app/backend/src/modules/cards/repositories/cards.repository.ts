import { Injectable } from '@nestjs/common';
import { mapping } from 'cassandra-driver';

import { CassandraService } from '../../../shared/cassandra/cassandra.service';
import {
  type AlertRow,
  type CardStateRow,
  iso,
  num,
  type Page,
  pageOptions,
  toPage,
  type TxnRow,
} from '../../../shared/cassandra/models';
import type { AlertDto, AlertStatus, CardStateDto, Channel, TxnDto, Verdict } from '../types/cards.types';

type ByCard = { cardId: string };

@Injectable()
export class CardsRepository {
  private readonly txns: mapping.ModelMapper<TxnRow>;
  private readonly alertRows: mapping.ModelMapper<AlertRow>;
  private readonly states: mapping.ModelMapper<CardStateRow>;
  private readonly txnById: (doc: ByCard & { txnId: string }) => Promise<mapping.Result<TxnRow>>;

  constructor(db: CassandraService) {
    this.txns = db.mapper.forModel<TxnRow>('Txn');
    this.alertRows = db.mapper.forModel<AlertRow>('Alert');
    this.states = db.mapper.forModel<CardStateRow>('CardState');
    this.txnById = this.txns.mapWithQuery(
      'SELECT * FROM txn_by_card WHERE card_id = ? AND txn_id = ? ALLOW FILTERING',
      (doc: ByCard & { txnId: string }) => [doc.cardId, doc.txnId],
    );
  }

  async transactionPage(cardId: string, limit: number, cursor?: string): Promise<Page<TxnDto>> {
    return toPage(await this.txns.find({ cardId }, undefined, pageOptions(limit, cursor)), toTxn);
  }

  async transactions(cardId: string, limit: number): Promise<TxnDto[]> {
    const result = await this.txns.find({ cardId }, { limit });
    return result.toArray().map(toTxn);
  }

  async transactionsSince(cardId: string, since: Date, limit: number): Promise<TxnDto[]> {
    const result = await this.txns.find({ cardId, ts: mapping.q.gte(since) }, { limit });
    return result.toArray().map(toTxn);
  }

  async transaction(cardId: string, txnId: string): Promise<TxnDto | null> {
    const row = (await this.txnById({ cardId, txnId })).first();
    return row ? toTxn(row) : null;
  }

  async alerts(cardId: string, limit: number): Promise<AlertDto[]> {
    const [alerts, txns] = await Promise.all([
      this.alertRows.find({ cardId }, { limit }),
      this.transactions(cardId, 500),
    ]);
    const merchants = new Map(txns.map((t) => [t.txnId, t.merchant]));
    return alerts.toArray().map((r) => ({
      alertId: r.alertId,
      txnId: r.txnId,
      ruleId: r.ruleId,
      ts: iso(r.ts) ?? '',
      amount: num(r.amount),
      merchant: merchants.get(r.txnId) ?? 'Unknown merchant',
      status: (r.status as AlertStatus | null) ?? 'OPEN',
    }));
  }

  async cardState(cardId: string): Promise<CardStateDto | null> {
    const row = await this.states.get({ cardId });
    if (!row) return null;
    return {
      cardId: row.cardId,
      riskScore: num(row.riskScore),
      priority: num(row.priority),
      amountSum: num(row.amountSum),
      openAlerts: row.openAlerts ?? 0,
      lastDecision: row.lastDecision as Verdict | null,
      updatedAt: iso(row.updatedAt),
    };
  }
}

function toTxn(r: TxnRow): TxnDto {
  return {
    txnId: r.txnId,
    ts: iso(r.ts) ?? '',
    channel: (r.channel as Channel | null) ?? 'CARD',
    merchant: r.merchant,
    counterpartyAccount: r.counterpartyAccount,
    category: r.category,
    amount: num(r.amount),
    currency: r.currency ?? 'VND',
    decision: (r.decision as Verdict | null) ?? 'ALLOW',
    score: num(r.score),
    firedRules: [...(r.firedRules ?? [])].sort(),
  };
}
