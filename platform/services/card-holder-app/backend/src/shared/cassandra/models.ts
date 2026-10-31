import { mapping, types } from 'cassandra-driver';

const camelCase = new mapping.UnderscoreCqlToCamelCaseMappings();

export const MODELS: mapping.MappingOptions = {
  models: {
    Txn: { tables: ['txn_by_card'], mappings: camelCase },
    Alert: { tables: ['alerts_by_card'], mappings: camelCase },
    CardState: { tables: ['card_state'], mappings: camelCase },
    Triage: { tables: ['triage_queue'], mappings: camelCase },
    Control: { tables: ['controls_by_card'], mappings: camelCase },
  },
};

export type TxnRow = {
  cardId: string;
  ts: Date;
  txnId: string;
  channel: string | null;
  direction: string | null;
  merchant: string;
  recipientAccount: string | null;
  category: string;
  amount: types.BigDecimal | null;
  currency: string | null;
  decision: string | null;
  score: number | null;
  firedRules: string[] | null;
  status: string | null;
  declinedFor: string[] | null;
};

export type AlertRow = {
  cardId: string;
  ts: Date;
  alertId: string;
  txnId: string;
  ruleId: string;
  score: number | null;
  amount: types.BigDecimal | null;
  status: string | null;
};

export type CardStateRow = {
  cardId: string;
  riskScore: number | null;
  priority: number | null;
  amountSum: types.BigDecimal | null;
  openAlerts: number | null;
  lastDecision: string | null;
  updatedAt: Date | null;
};

export type TriageRow = {
  bucket: string;
  cardId: string;
  priority: number | null;
  riskScore: number | null;
  amountSum: types.BigDecimal | null;
  openAlerts: number | null;
  lastDecision: string | null;
  updatedAt: Date | null;
};

export type ControlRow = {
  cardId: string;
  controlId: string;
  kind: string;
  merchant: string | null;
  rule: string | null;
  budgetLimit: types.BigDecimal | null;
  budgetPeriod: string | null;
  updatedAt: Date | null;
};

export type Page<T> = { items: T[]; nextCursor: string | null };

export function pageOptions(limit: number, cursor?: string): mapping.MappingExecutionOptions {
  return { fetchSize: limit, pageState: cursor as unknown as number };
}

export function toPage<R, T>(result: mapping.Result<R>, map: (row: R) => T): Page<T> {
  const { pageState } = result as mapping.Result<R> & { pageState?: string | null };
  return { items: result.toArray().map(map), nextCursor: pageState ?? null };
}

export function iso(ts: Date | null | undefined): string | null {
  return ts ? ts.toISOString() : null;
}

export function num(value: types.BigDecimal | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : value.toNumber();
}
