import { oneOf, positive, record, text } from '../common/validation';

export const PERIODS = ['DAY', 'WEEK', 'MONTH'] as const;
export type Period = (typeof PERIODS)[number];

export const RULE_TYPES = ['BLOCK', 'ALLOW'] as const;
export type RuleType = (typeof RULE_TYPES)[number];

export type BudgetDto = { limit: number; period: Period; updatedAt: string | null };

export type MerchantRuleDto = { merchant: string; type: RuleType; createdAt: string };

export type ControlsDto = { budget: BudgetDto | null; merchantRules: MerchantRuleDto[] };

export type ControlAction = 'SET_BUDGET' | 'SET_MERCHANT_RULE' | 'RELEASE_MERCHANT';

export type ControlEvent = {
  action: ControlAction;
  control_id: string;
  ts: string;
  kind: 'BUDGET' | 'MERCHANT' | null;
  merchant: string | null;
  rule: RuleType | null;
  budget_limit: number | null;
  budget_period: Period | null;
  updated_at: string | null;
};

type ControlFields = Omit<ControlEvent, 'action' | 'control_id' | 'ts'>;

const NO_FIELDS: ControlFields = {
  kind: null,
  merchant: null,
  rule: null,
  budget_limit: null,
  budget_period: null,
  updated_at: null,
};

export const BUDGET_ID = 'budget';
export const MERCHANT_PREFIX = 'merchant:';

export function merchantControlId(merchant: string): string {
  return `${MERCHANT_PREFIX}${merchant}`;
}

export function controlEvent(action: ControlAction, controlId: string, ts: string, fields: Partial<ControlFields> = {}): ControlEvent {
  return { action, control_id: controlId, ts, ...NO_FIELDS, ...fields };
}

export function parseBudget(body: unknown): { limit: number; period: Period } {
  const b = record(body, 'body');
  return { limit: positive(b.limit, 'limit'), period: oneOf(b.period, 'period', PERIODS) };
}

export function parseRuleType(body: unknown): RuleType {
  return oneOf(record(body, 'body').type, 'type', RULE_TYPES);
}

export function parseMerchant(value: string): string {
  return text(value, 'merchant', 120);
}
