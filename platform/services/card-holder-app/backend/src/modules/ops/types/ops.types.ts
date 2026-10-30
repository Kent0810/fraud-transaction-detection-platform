import { z } from 'zod';

import type { StaffMember } from '../../../common/decorators/staff.decorator';
import { Password, text } from '../../../common/validation';
import type { CardStateDto, TxnDto, Verdict } from '../../cards/types/cards.types';
import type { ControlsDto } from '../../controls/types/controls.types';
import { RULE_TYPES } from '../../controls/types/controls.types';

export type StaffSessionDto = StaffMember & {
  token: string;
  expiresAt: string;
};

export type QueueItemDto = {
  cardId: string;
  priority: number;
  riskScore: number;
  amountSum: number;
  openAlerts: number;
  lastDecision: Verdict | null;
  updatedAt: string | null;
};

export type CardholderDto = {
  name: string;
  email: string;
  city: string | null;
  state: string | null;
  dob: string | null;
};

export type AccountDto = {
  accountNumber: string;
  balance: number;
  currency: string;
  frozen: boolean;
};

export type LoginStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED';

/** The cardholder's app sign-in: LOCKED after too many wrong passwords, DISABLED by an agent. */
export type LoginDto = {
  status: LoginStatus;
  failedLogins: number;
  lastLoginAt: string | null;
};

export type CardViewDto = {
  cardId: string;
  holder: CardholderDto;
  account: AccountDto | null;
  login: LoginDto | null;
  state: CardStateDto | null;
  controls: ControlsDto;
};

export type ReviewStatus = 'OPEN' | 'CONFIRMED' | 'CLEARED';

export type CaseAlertDto = {
  alertId: string;
  ruleId: string;
  ts: string;
  score: number;
  status: ReviewStatus;
};

export type ActivityDto = TxnDto & { alerts: CaseAlertDto[] };

export type AuditEntryDto = {
  auditId: string;
  at: string;
  action: string;
  staffName: string;
  staffRole: string;
  payload: unknown;
};

export const StaffLoginRequest = z.object({
  email: z.email().max(200),
  password: Password,
});
export type StaffLoginRequest = z.infer<typeof StaffLoginRequest>;

const Reason = text(500)
  .nullish()
  .transform((r) => r ?? null);

export const StaffMerchantRuleRequest = z.object({
  type: z.enum(RULE_TYPES),
  reason: Reason,
});
export type StaffMerchantRuleRequest = z.infer<typeof StaffMerchantRuleRequest>;

export const ReasonRequest = z.object({ reason: Reason }).default({ reason: null });
export type ReasonRequest = z.infer<typeof ReasonRequest>;

export const AlertReviewRequest = z.object({
  ts: z.iso.datetime(),
  status: z.enum(['CONFIRMED', 'CLEARED']),
  reason: Reason,
});
export type AlertReviewRequest = z.infer<typeof AlertReviewRequest>;

export const AlertId = text(200);

export const Lookup = text(19).regex(/^\d+$/, 'must be a card or account number');

export const Days = z.coerce.number().int().min(1).max(90).default(30);
