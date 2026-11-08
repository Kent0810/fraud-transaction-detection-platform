export type StaffRole = 'ANALYST' | 'AGENT';

export type StaffMember = {
  staffId: number;
  name: string;
  email: string;
  role: StaffRole;
};

export type StaffSession = StaffMember & {
  token: string;
  expiresAt: string;
};

export type Verdict = 'ALLOW' | 'STEP_UP' | 'DECLINE';

export type ReviewStatus = 'OPEN' | 'CONFIRMED' | 'CLEARED';

export type RuleType = 'BLOCK' | 'ALLOW';

export type LoginStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED';

// What the ledger did with an allowed transaction; null until it has, and for anything not allowed.
export type PostingStatus = 'HELD' | 'POSTED' | 'DECLINED';

export type QueueItem = {
  cardId: string;
  priority: number;
  riskScore: number;
  amountSum: number;
  openAlerts: number;
  lastDecision: Verdict | null;
  updatedAt: string | null;
};

export type FlaggedPayment = {
  txnId: string;
  cardId: string;
  ts: string;
  decision: Verdict;
  firedRules: string[];
};

export type CaseAlert = {
  alertId: string;
  ruleId: string;
  ts: string;
  score: number;
  status: ReviewStatus;
};

export type Activity = {
  txnId: string;
  ts: string;
  channel: 'CARD' | 'TRANSFER';
  // IN: received from another card of this bank; merchant and recipientAccount are the sender's.
  direction: 'IN' | 'OUT';
  merchant: string;
  recipientAccount: string | null;
  category: string;
  amount: number;
  currency: string;
  // Where a card payment was made; null for transfers.
  merchLat: number | null;
  merchLong: number | null;
  decision: Verdict;
  score: number;
  firedRules: string[];
  status: PostingStatus | null;
  declinedFor: string[];
  alerts: CaseAlert[];
};

/** A transfer held for an agent: no money has moved, and it is declined at heldUntil if nobody answers. */
export type HeldTransfer = {
  cardId: string;
  txnId: string;
  ts: string;
  amount: number;
  toName: string;
  toAccount: string;
  heldUntil: string;
};

export type RecipientRule = {
  recipientId: string;
  name: string;
  type: RuleType;
  createdAt: string;
};

export type RecipientRef =
  { kind: 'MERCHANT'; name: string } | { kind: 'ACCOUNT'; account: string; name?: string | null };

export type FollowupStatus = 'PENDING' | 'GENUINE' | 'FRAUD';

export type Followup = {
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

export type FraudMark = {
  recipientId: string;
  recipientName: string;
  cardId: string;
  markedBy: string;
  markedAt: string;
};

export type CardView = {
  cardId: string;
  holder: {
    name: string;
    email: string;
    city: string | null;
    state: string | null;
    dob: string | null;
    home: { lat: number; long: number } | null;
  };
  account: {
    accountNumber: string;
    balance: number;
    currency: string;
    frozen: boolean;
  } | null;
  login: {
    status: LoginStatus;
    failedLogins: number;
    lastLoginAt: string | null;
  } | null;
  state: {
    riskScore: number;
    priority: number;
    amountSum: number;
    openAlerts: number;
    lastDecision: Verdict | null;
    updatedAt: string | null;
  } | null;
  controls: {
    budget: {
      limit: number;
      period: 'DAY' | 'WEEK' | 'MONTH';
      updatedAt: string | null;
    } | null;
    recipientRules: RecipientRule[];
  };
};

export type AuditEntry = {
  auditId: string;
  at: string;
  action: string;
  staffName: string;
  staffRole: StaffRole;
  payload: Record<string, string | null>;
};

export type LiveAlert = {
  txnId: string;
  cardId: string;
  ts: string;
  merchant: string;
  category: string;
  amount: number;
  currency: string;
  // ALLOW: the payment went through, but an alert-only rule raised an alert on it.
  decision: 'ALLOW' | 'STEP_UP' | 'DECLINE';
  score: number;
  firedRules: string[];
};

export type ReceivedAlert = LiveAlert & {
  receivedAt: number;
};
