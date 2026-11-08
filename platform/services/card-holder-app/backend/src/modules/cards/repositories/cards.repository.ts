import { Injectable } from '@nestjs/common';
import { mapping } from 'cassandra-driver';

import { CassandraService } from '../../../shared/cassandra/cassandra.service';
import { type AlertRow, iso, num, type Page, pageOptions, toPage, type TxnRow } from '../../../shared/cassandra/models';
import type { AlertDto, AlertStatus, Channel, TxnDto, Verdict } from '../types/cards.types';

type ByCard = { cardId: string };

// A fraud mark is the bank's suspicion about someone else, and can be wrong: only staff see it.
const STAFF_ONLY_RULES = new Set(['FRAUD_RECIPIENT']);

/** A transaction as its cardholder sees it. */
export function forCardholder(t: TxnDto): TxnDto {
  return {
    ...t,
    firedRules: t.firedRules.filter((r) => !STAFF_ONLY_RULES.has(r)),
  };
}

@Injectable()
export class CardsRepository {
  private readonly txns: mapping.ModelMapper<TxnRow>;
  private readonly alertRows: mapping.ModelMapper<AlertRow>;
  private readonly txnById: (doc: ByCard & { txnId: string }) => Promise<mapping.Result<TxnRow>>;

  constructor(db: CassandraService) {
    this.txns = db.mapper.forModel<TxnRow>('Txn');
    this.alertRows = db.mapper.forModel<AlertRow>('Alert');
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
    const byId = new Map(txns.map((t) => [t.txnId, t]));
    return alerts
      .toArray()
      .filter((r) => !STAFF_ONLY_RULES.has(r.ruleId))
      .map((r) => ({
        alertId: r.alertId,
        txnId: r.txnId,
        ruleId: r.ruleId,
        ts: iso(r.ts) ?? '',
        amount: num(r.amount),
        merchant: byId.get(r.txnId)?.merchant ?? 'Unknown merchant',
        // No case status: an allowed payment never goes to triage, so it never needs review.
        status: (r.status as AlertStatus | null) ?? (byId.get(r.txnId)?.decision === 'ALLOW' ? 'APPROVED' : 'OPEN'),
      }));
  }
}

function toTxn(r: TxnRow): TxnDto {
  return {
    txnId: r.txnId,
    ts: iso(r.ts) ?? '',
    channel: (r.channel as Channel | null) ?? 'CARD',
    direction: r.direction === 'IN' ? 'IN' : 'OUT',
    merchant: r.merchant,
    recipientAccount: r.recipientAccount,
    category: r.category,
    amount: num(r.amount),
    currency: r.currency ?? 'VND',
    merchLat: r.merchLat ?? null,
    merchLong: r.merchLong ?? null,
    decision: (r.decision as Verdict | null) ?? 'ALLOW',
    score: num(r.score),
    firedRules: [...(r.firedRules ?? [])].sort(),
    status: r.status === 'HELD' || r.status === 'POSTED' || r.status === 'DECLINED' ? r.status : null,
    declinedFor: [...(r.declinedFor ?? [])].sort(),
  };
}
