import { z } from 'zod';

import { Password, text } from '../../../common/validation';

export const PERIODS = ['DAY', 'WEEK', 'MONTH'] as const;
export type Period = (typeof PERIODS)[number];

export const RULE_TYPES = ['BLOCK', 'ALLOW'] as const;
export type RuleType = (typeof RULE_TYPES)[number];

export type BudgetDto = {
  limit: number;
  period: Period;
  updatedAt: string | null;
};

export type MerchantRuleDto = {
  merchant: string;
  type: RuleType;
  createdAt: string;
};

export type ControlsDto = { budget: BudgetDto | null; merchantRules: MerchantRuleDto[] };

export type CardStatusDto = { frozen: boolean };

export type ControlAction = 'SET_BUDGET' | 'SET_MERCHANT_RULE' | 'RELEASE_MERCHANT' | 'FREEZE_CARD' | 'UNFREEZE_CARD';

export type ControlEvent = {
  action: ControlAction;
  control_id: string;
  ts: string;
  kind: 'BUDGET' | 'MERCHANT' | 'FREEZE' | null;
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
export const FREEZE_ID = 'freeze';
export const MERCHANT_PREFIX = 'merchant:';

export function merchantControlId(merchant: string): string {
  return `${MERCHANT_PREFIX}${merchant}`;
}

export function controlEvent(
  action: ControlAction,
  controlId: string,
  ts: string,
  fields: Partial<ControlFields> = {},
): ControlEvent {
  return { action, control_id: controlId, ts, ...NO_FIELDS, ...fields };
}

export const BudgetRequest = z.object({ limit: z.number().positive(), period: z.enum(PERIODS) });
export type BudgetRequest = z.infer<typeof BudgetRequest>;

export const MerchantRuleRequest = z.object({ type: z.enum(RULE_TYPES) });
export type MerchantRuleRequest = z.infer<typeof MerchantRuleRequest>;

export const Merchant = text(120);

export const UnfreezeRequest = z.object({ password: Password });
export type UnfreezeRequest = z.infer<typeof UnfreezeRequest>;
