import type { Prisma } from '@platform/db';

export type AuditAction =
  | 'VIEW_CARDHOLDER'
  | 'BLOCK_RECIPIENT'
  | 'ALLOW_RECIPIENT'
  | 'RELEASE_RECIPIENT'
  | 'CUSTOMER_GENUINE'
  | 'CUSTOMER_FRAUD'
  | 'REMOVE_FRAUD_MARK'
  | 'FREEZE_CARD'
  | 'UNFREEZE_CARD'
  | 'CONFIRM_ALERT'
  | 'CLEAR_ALERT'
  | 'DISABLE_LOGIN'
  | 'RESTORE_LOGIN';

/** The staff member behind a change made from the operations console. */
export type StaffAudit = {
  staffId: number;
  reason: string | null;
};

export function auditEntry(
  by: StaffAudit,
  action: AuditAction,
  cardId: string,
  details: Record<string, string | null> = {},
): Prisma.audit_logCreateManyInput {
  return {
    staff_id: by.staffId,
    action,
    card_id: cardId,
    payload: { ...details, reason: by.reason },
  };
}
