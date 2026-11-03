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

export type FollowupStatus = 'PENDING' | 'GENUINE' | 'FRAUD';

/** A transaction an analyst confirmed as fraud, and how the agent's call to the cardholder went. */
export type FollowupDto = {
  cardId: string;
  txnId: string;
  ts: string;
  holderName: string;
  holderEmail: string;
  recipientId: string;
  recipientName: string;
  amount: number;
  status: FollowupStatus;
  confirmedBy: string;
  confirmedAt: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  note: string | null;
};

export type FraudMarkDto = {
  recipientId: string;
  recipientName: string;
  cardId: string;
  markedBy: string;
  markedAt: string;
};

// A card this staff member opened, from their own VIEW_CARDHOLDER audit rows: the bank's record, not the browser's.
export type RecentCardDto = {
  cardId: string;
  name: string;
  openedAt: string;
};

export const StaffLoginRequest = z.object({
  email: z.email().max(200),
  password: Password,
});
export type StaffLoginRequest = z.infer<typeof StaffLoginRequest>;

const Reason = text(500)
  .nullish()
  .transform((r) => r ?? null);

const RecipientRef = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('MERCHANT'), name: text(120) }),
  z.object({
    kind: z.literal('ACCOUNT'),
    account: z.string().regex(/^[A-Za-z]{2,10}:\d{6,19}$/, 'must be <bank code>:<account number>'),
    name: text(120).nullish(),
  }),
]);

export const StaffRecipientRuleRequest = z.object({
  recipient: RecipientRef,
  type: z.enum(RULE_TYPES),
  reason: Reason,
});
export type StaffRecipientRuleRequest = z.infer<typeof StaffRecipientRuleRequest>;

export const RecipientId = text(200);

export const FollowupOutcomeRequest = z.object({
  outcome: z.enum(['GENUINE', 'FRAUD']),
  reason: Reason,
});
export type FollowupOutcomeRequest = z.infer<typeof FollowupOutcomeRequest>;

export const TxnId = text(200);

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
