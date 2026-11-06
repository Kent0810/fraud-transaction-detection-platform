import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';

import * as commands from './commands';
import { HttpError } from './http';
import { followNotices } from './live';
import {
  type Controls,
  fetchAccountHolder,
  fetchAlerts,
  fetchBalance,
  fetchCardStatus,
  fetchControls,
  fetchMerchants,
  fetchPayment,
  fetchRecipients,
  fetchTransactions,
  fetchTransfer,
} from './queries';
import { useUser } from './auth';
import { useSettings } from './settings';

import type {
  Alert,
  Budget,
  CardNotice,
  PayMerchant,
  Payment,
  Period,
  Recipient,
  Transfer,
  TransferTo,
  Txn,
} from './types';

export type TransferDraft = {
  to: TransferTo;
  amount: number;
  content: string;
  save: boolean;
};

export type DataStatus = 'loading' | 'ready' | 'error';

type Store = {
  status: DataStatus;
  error: string | null;
  cardId: string | null;
  refresh: () => void;
  reload: () => void;
  transactions: Txn[];
  alerts: Alert[];
  budget: Budget;
  frozen: boolean;
  /** What can be spent: held transfers already taken off. */
  balance: number;
  /** Set aside for transfers waiting for bank confirmation. */
  held: number;
  accountNumber: string;
  saved: Recipient[];
  transfers: Transfer[];
  draft: TransferDraft | null;
  freezeCard: () => Promise<void>;
  unfreezeCard: (password: string) => Promise<void>;
  setBudget: (limit: number, period: Period) => void;
  setDraft: (draft: TransferDraft | null) => void;
  lookupAccount: (account: string) => Promise<string | null>;
  sendTransfer: (draft: TransferDraft, transferId: string, password: string) => Promise<Transfer>;
  refreshTransfer: (transferId: string) => Promise<Transfer | null>;
  notice: CardNotice | null;
  dismissNotice: () => void;
  merchantsNearby: () => Promise<PayMerchant[]>;
  pay: (merchant: PayMerchant, amount: number, paymentId: string, password: string, qr?: string) => Promise<Payment>;
  removeSaved: (recipient: Recipient) => void;
};

const StoreContext = createContext<Store | null>(null);

// A card with no budget set: the limit stays 0 until the cardholder chooses one.
const NO_BUDGET: Budget = { limit: 0, period: 'MONTH', spent: 0 };

// How long sendTransfer waits for the fraud check before handing back a PENDING transfer.
const DECISION_POLL_MS = 500;
const DECISION_WAIT_MS = 10_000;
const NOTICE_RELOAD_MS = 600;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A transfer the bank refused; message is safe to show as is. */
export class TransferError extends Error {}

/** A card payment the bank refused before the fraud check; message is safe to show as is. */
export class PaymentError extends Error {}

function paymentError(e: unknown): Error {
  if (!(e instanceof HttpError)) return e instanceof Error ? e : new Error(String(e));
  switch (e.status) {
    case 423:
      return new PaymentError('Your card is frozen. Unfreeze it to pay.');
    case 403:
      return new PaymentError('Incorrect password');
    case 404:
      return new PaymentError('This merchant is no longer available');
    case 422:
      return new PaymentError(
        e.detail === 'insufficient funds' ? 'Not enough balance for this payment' : (e.detail ?? 'Payment refused'),
      );
    default:
      return new PaymentError('Payment failed. Check your balance before trying again.');
  }
}

/** A freeze or unfreeze the bank refused; message is safe to show as is. */
export class CardError extends Error {}

function transferError(e: unknown): Error {
  if (!(e instanceof HttpError)) return e instanceof Error ? e : new Error(String(e));
  switch (e.status) {
    case 423:
      return new TransferError('Your card is frozen. Unfreeze it to send money.');
    case 403:
      return new TransferError('Incorrect password');
    case 404:
      return new TransferError('Recipient account not found');
    case 422:
      return new TransferError('Transfer refused: not enough balance, or the recipient is your own account');
    default:
      return new TransferError('Transfer failed. Check your balance before trying again.');
  }
}

type CardData = {
  transactions: Txn[];
  alerts: Alert[];
  controls: Controls;
  balance: number;
  held: number;
  accountNumber: string;
  saved: Recipient[];
  frozen: boolean;
};

async function fetchCardData(): Promise<CardData> {
  const [transactions, alerts, controls, account, saved, card] = await Promise.all([
    fetchTransactions(),
    fetchAlerts(),
    fetchControls(),
    fetchBalance(),
    fetchRecipients(),
    fetchCardStatus(),
  ]);
  return {
    transactions,
    alerts,
    controls,
    balance: account.available,
    held: account.held,
    accountNumber: account.accountNumber,
    saved,
    frozen: card.frozen,
  };
}

const sameRecipient = (a: Recipient, b: Recipient) => a.account === b.account;

const withControls = (budget: Budget, controls: Controls): Budget =>
  controls.budget ? { ...budget, limit: controls.budget.limit, period: controls.budget.period } : budget;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function StoreProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const cardId = user.cardId;
  const [budget, setBudgetState] = useState<Budget>(NO_BUDGET);
  const [frozen, setFrozen] = useState(false);
  const [balance, setBalance] = useState(0);
  const [held, setHeld] = useState(0);
  const [accountNumber, setAccountNumber] = useState('');
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [saved, setSaved] = useState<Recipient[]>([]);
  const [draft, setDraft] = useState<TransferDraft | null>(null);
  const [status, setStatus] = useState<DataStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // A background poll that fails keeps what is on screen instead of showing the error banner.
  const load = useCallback((background = false) => {
    fetchCardData().then(
      (data) => {
        setTransactions(data.transactions);
        setAlerts(data.alerts);
        setBudgetState((b) => withControls(b, data.controls));
        setBalance(data.balance);
        setHeld(data.held);
        setAccountNumber(data.accountNumber);
        setSaved(data.saved);
        setFrozen(data.frozen);
        setError(null);
        setStatus('ready');
      },
      (e: unknown) => {
        if (background) return;
        setError(message(e));
        setStatus('error');
      },
    );
  }, []);

  const reloadControls = useCallback(() => {
    fetchControls().then(
      (controls) => {
        setBudgetState((b) => withControls(b, controls));
      },
      (e: unknown) => setError(message(e)),
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // There is no push channel: fetch again whenever the app comes back to the foreground (screens do so on focus).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load(true);
    });
    return () => sub.remove();
  }, [load]);

  const refresh = useCallback(() => {
    setStatus('loading');
    load();
  }, [load]);

  const reload = useCallback(() => {
    load(true);
  }, [load]);

  const { notifyDeclines, notifyTransfers } = useSettings();
  const showRef = useRef({ notifyDeclines, notifyTransfers });
  useEffect(() => {
    showRef.current = { notifyDeclines, notifyTransfers };
  }, [notifyDeclines, notifyTransfers]);
  const [notice, setNotice] = useState<CardNotice | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const stop = followNotices((n) => {
      if (!pending) {
        pending = setTimeout(() => {
          pending = null;
          load(true);
        }, NOTICE_RELOAD_MS);
      }
      const show = showRef.current;
      const shown =
        n.kind === 'DECLINED'
          ? show.notifyDeclines
          : show.notifyTransfers && (n.kind === 'RECEIVED' || n.channel === 'TRANSFER');
      if (shown) setNotice(n);
    });
    return () => {
      stop();
      if (pending) clearTimeout(pending);
    };
  }, [load]);

  const effectiveBudget = useMemo<Budget>(() => {
    const now = new Date();
    const spent = transactions
      .filter((t) => t.direction !== 'IN' && t.decision !== 'DECLINE' && t.status !== 'DECLINED')
      .filter((t) => {
        const d = new Date(t.ts);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, t) => sum + t.amount, 0);
    return { ...budget, spent };
  }, [budget, transactions]);

  // Not optimistic: the card shows as frozen only once the bank has saved it, so it never looks safer than it is.
  const freezeCard = useCallback(async () => {
    const status = await commands.freezeCard().catch((e: unknown) => {
      throw new CardError(`Could not freeze the card: ${message(e)}`);
    });
    setFrozen(status.frozen);
  }, []);

  const unfreezeCard = useCallback(async (password: string) => {
    const status = await commands.unfreezeCard(password).catch((e: unknown) => {
      throw new CardError(
        e instanceof HttpError && e.status === 403 ? 'Incorrect password' : `Could not unfreeze: ${message(e)}`,
      );
    });
    setFrozen(status.frozen);
  }, []);

  const setBudget = useCallback(
    (limit: number, period: Period) => {
      setBudgetState((b) => ({ ...b, limit, period }));
      commands.setBudget(limit, period).catch(reloadControls);
    },
    [reloadControls],
  );

  const reloadSaved = useCallback(() => {
    fetchRecipients().then(setSaved, (e: unknown) => setError(message(e)));
  }, []);

  const keepTransfer = useCallback((transfer: Transfer) => {
    setTransfers((ts) => [transfer, ...ts.filter((t) => t.transferId !== transfer.transferId)]);
  }, []);

  const refreshTransfer = useCallback(
    async (transferId: string) => {
      const { balance: now, ...transfer } = await fetchTransfer(transferId);
      keepTransfer(transfer);
      setBalance(now);
      return transfer;
    },
    [keepTransfer],
  );

  const sendTransfer = useCallback(
    async (d: TransferDraft, transferId: string, password: string) => {
      // The server checks the password, the balance and the recipient and records the transfer as PENDING; the fraud
      // check then approves it (the money moves) or declines it. Wait a little for that before showing the receipt.
      const { balance: now, ...requested } = await commands
        .sendTransfer({ transferId, to: d.to, amount: d.amount, content: d.content, password })
        .catch((e: unknown) => {
          throw transferError(e);
        });
      let transfer: Transfer = requested;
      setBalance(now);
      for (let waited = 0; transfer.status === 'PENDING' && waited < DECISION_WAIT_MS; waited += DECISION_POLL_MS) {
        await wait(DECISION_POLL_MS);
        transfer = (await refreshTransfer(transferId).catch(() => null)) ?? transfer;
      }
      keepTransfer(transfer);
      if (d.save && transfer.status !== 'DECLINED') {
        const r = { account: d.to.account, name: d.to.name };
        setSaved((rs) => (rs.some((x) => sameRecipient(x, r)) ? rs : [r, ...rs]));
        commands.saveRecipient(r).catch(reloadSaved);
      }
      return transfer;
    },
    [reloadSaved, refreshTransfer, keepTransfer],
  );

  const removeSaved = useCallback(
    (recipient: Recipient) => {
      setSaved((rs) => rs.filter((r) => !sameRecipient(r, recipient)));
      commands.removeRecipient(recipient).catch(reloadSaved);
    },
    [reloadSaved],
  );

  // Like sendTransfer: recorded PENDING, then wait a little for the fraud check before showing the result.
  const pay = useCallback(
    async (
      merchant: PayMerchant,
      amount: number,
      paymentId: string,
      password: string,
      qr?: string,
    ): Promise<Payment> => {
      let { balance: now, ...payment } = await commands
        .sendPayment({ paymentId, merchantId: merchant.merchantId, amount, password, qr })
        .catch((e: unknown) => {
          throw paymentError(e);
        });
      for (let waited = 0; payment.status === 'PENDING' && waited < DECISION_WAIT_MS; waited += DECISION_POLL_MS) {
        await wait(DECISION_POLL_MS);
        const latest = await fetchPayment(paymentId).catch(() => null);
        if (latest) ({ balance: now, ...payment } = latest);
      }
      setBalance(now);
      return payment;
    },
    [],
  );

  const value = useMemo<Store>(
    () => ({
      status,
      error,
      cardId,
      refresh,
      reload,
      notice,
      dismissNotice,
      transactions,
      alerts,
      budget: effectiveBudget,
      frozen,
      balance,
      held,
      accountNumber,
      saved,
      transfers,
      draft,
      freezeCard,
      unfreezeCard,
      setBudget,
      setDraft,
      lookupAccount: fetchAccountHolder,
      sendTransfer,
      refreshTransfer,
      merchantsNearby: fetchMerchants,
      pay,
      removeSaved,
    }),
    [
      status,
      error,
      cardId,
      refresh,
      reload,
      notice,
      dismissNotice,
      transactions,
      alerts,
      effectiveBudget,
      frozen,
      balance,
      held,
      accountNumber,
      saved,
      transfers,
      draft,
      freezeCard,
      unfreezeCard,
      setBudget,
      sendTransfer,
      refreshTransfer,
      pay,
      removeSaved,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useStore must be used inside StoreProvider');
  }
  return store;
}

/** Fetches the newest card data each time the calling screen comes into view. */
export function useFreshOnFocus(): void {
  const { reload } = useStore();
  useFocusEffect(reload);
}
