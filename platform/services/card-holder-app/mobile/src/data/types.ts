export type Verdict = 'ALLOW' | 'STEP_UP' | 'DECLINE';

export type Channel = 'CARD' | 'TRANSFER';

export type Txn = {
  txnId: string;
  ts: string;
  channel: Channel;
  // IN: received from another card of this bank; merchant and recipientAccount are the sender's.
  direction: 'IN' | 'OUT';
  merchant: string;
  recipientAccount: string | null;
  category: string;
  amount: number;
  currency: string;
  decision: Verdict;
  score: number;
  firedRules: string[];
  // Null until the ledger has posted or declined it (never for a fraud DECLINE); HELD while the bank confirms it.
  status: 'HELD' | 'POSTED' | 'DECLINED' | null;
  declinedFor: string[];
};

// APPROVED: a flag on a payment that went through (e.g. over budget); nobody reviews it.
export type AlertStatus = 'OPEN' | 'CONFIRMED' | 'CLEARED' | 'APPROVED';

export type Alert = {
  alertId: string;
  txnId: string;
  ruleId: string;
  ts: string;
  amount: number;
  merchant: string;
  status: AlertStatus;
};

export type Period = 'DAY' | 'WEEK' | 'MONTH';

export type Budget = {
  limit: number;
  period: Period;
  spent: number;
};

// A saved recipient: always an account at this bank.
export type Recipient = {
  account: string;
  name: string;
};

/** A bank a transfer can go to, by its NAPAS bank id (BIN). */
export type Bank = { bin: string; code: string; name: string };

/** Who a transfer goes to: at this bank, or at another bank through NAPAS. */
export type TransferTo = Recipient & { bank: Bank };

// PENDING until the bank's fraud check decides; HELD while the bank confirms an unusual one; only POSTED moved the money.
export type TransferStatus = 'PENDING' | 'HELD' | 'POSTED' | 'DECLINED';

export type Transfer = {
  transferId: string;
  reference: string;
  to: TransferTo;
  amount: number;
  fee: number;
  content: string;
  status: TransferStatus;
  declinedFor: string[];
  ts: string;
};

// A merchant near the cardholder, from the dataset; paying one is a card payment like any other.
export type PayMerchant = {
  merchantId: string;
  name: string;
  category: string;
  distanceKm: number | null;
};

// A card payment made in the app. PENDING until the fraud check decides; only POSTED moved the money.
export type Payment = {
  paymentId: string;
  reference: string;
  merchant: string;
  category: string;
  amount: number;
  status: TransferStatus;
  declinedFor: string[];
  ts: string;
};

// What a scanned VietQR code points at, as the bank read it.
export type QrTarget =
  | { kind: 'TRANSFER'; account: string; name: string; amount: number | null; note: string | null }
  // qr: sent back with the payment; a code with an amount must be paid exactly that.
  | { kind: 'MERCHANT'; merchant: PayMerchant; amount: number | null; qr: string }
  | {
      kind: 'OTHER_BANK';
      bin: string;
      // Null for a bank a transfer can't reach.
      bank: Bank | null;
      account: string;
      toCard: boolean;
      name: string | null;
      amount: number | null;
      note: string | null;
    };

export type CardNotice = {
  kind: 'HELD' | 'POSTED' | 'DECLINED' | 'RECEIVED';
  txnId: string;
  ts: string;
  channel: Channel;
  counterparty: string;
  amount: number;
  reasons: string[];
};

/** The signed-in cardholder's own details. */
export type Profile = {
  cardId: string;
  accountNumber: string;
  name: string;
  email: string;
  gender: string | null;
  dob: string | null;
  address: string | null;
  job: string | null;
  memberSince: string;
};

/** The cardholder's own code, for receiving transfers. */
export type MyQr = { payload: string; account: string; name: string };
