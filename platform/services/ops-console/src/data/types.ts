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
export type PostingStatus = 'POSTED' | 'DECLINED';

export type QueueItem = {
  cardId: string;
  priority: number;
  riskScore: number;
  amountSum: number;
  openAlerts: number;
  lastDecision: Verdict | null;
  updatedAt: string | null;
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
  merchant: string;
  recipientAccount: string | null;
  category: string;
  amount: number;
  currency: string;
  decision: Verdict;
  score: number;
  firedRules: string[];
  status: PostingStatus | null;
  declinedFor: string[];
  alerts: CaseAlert[];
};

export type MerchantRule = {
  merchant: string;
  type: RuleType;
  createdAt: string;
};

export type CardView = {
  cardId: string;
  holder: {
    name: string;
    email: string;
    city: string | null;
    state: string | null;
    dob: string | null;
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
    merchantRules: MerchantRule[];
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
  decision: 'STEP_UP' | 'DECLINE';
  score: number;
  firedRules: string[];
};

export type ReceivedAlert = LiveAlert & {
  receivedAt: number;
};
