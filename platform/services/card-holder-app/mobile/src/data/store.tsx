import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as commands from './commands';
import { apiEnabled, HttpError } from './http';
import { type Controls, fetchAccountHolder, fetchAlerts, fetchBalance, fetchControls, fetchRecipients, fetchTransactions } from './queries';
import { MOCK_PASSWORD, useUser } from './auth';

import { ACCOUNT, ALERTS, BANKS, BUDGET, LOOKUP_NAMES, MERCHANT_RULES, TRANSACTIONS } from './mock';
import type { Alert, Bank, Budget, MerchantRule, Period, Recipient, RuleType, Transfer, TransferKind, Txn } from './types';

export type TransferDraft = { kind: TransferKind; to: Recipient; amount: number; content: string; save: boolean };

export type DataStatus = 'mock' | 'loading' | 'ready' | 'error';

type Store = {
  status: DataStatus;
  error: string | null;
  cardId: string | null;
  refresh: () => void;
  transactions: Txn[];
  alerts: Alert[];
  budget: Budget;
  rules: MerchantRule[];
  frozen: boolean;
  balance: number;
  accountNumber: string;
  banks: Bank[];
  saved: Recipient[];
  transfers: Transfer[];
  draft: TransferDraft | null;
  toggleFrozen: () => void;
  setBudget: (limit: number, period: Period) => void;
  setMerchantRule: (merchant: string, type: RuleType) => void;
  releaseMerchant: (merchant: string) => void;
  ruleFor: (merchant: string) => MerchantRule | undefined;
  setDraft: (draft: TransferDraft | null) => void;
  lookupAccount: (bankCode: string, account: string) => Promise<string | null>;
  sendTransfer: (draft: TransferDraft, transferId: string, password: string) => Promise<Transfer>;
  removeSaved: (recipient: Recipient) => void;
};

const StoreContext = createContext<Store | null>(null);

const PROPAGATION_MS = 1500;
const LOOKUP_MS = 700;
const TRANSFER_MS = 1200;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A transfer the bank refused; message is safe to show as is. */
export class TransferError extends Error {}

function transferError(e: unknown): Error {
  if (!(e instanceof HttpError)) return e instanceof Error ? e : new Error(String(e));
  switch (e.status) {
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
  accountNumber: string;
  saved: Recipient[];
};

async function fetchCardData(): Promise<CardData> {
  const [transactions, alerts, controls, account, saved] = await Promise.all([
    fetchTransactions(),
    fetchAlerts(),
    fetchControls(),
    fetchBalance(),
    fetchRecipients(),
  ]);
  return { transactions, alerts, controls, balance: account.balance, accountNumber: account.accountNumber, saved };
}

const sameRecipient = (a: Recipient, b: Recipient) => a.bankCode === b.bankCode && a.account === b.account;

const toRules = (controls: Controls): MerchantRule[] => controls.merchantRules.map((r) => ({ ...r, pending: false }));

const withControls = (budget: Budget, controls: Controls): Budget =>
  controls.budget ? { ...budget, limit: controls.budget.limit, period: controls.budget.period } : budget;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function StoreProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const cardId = user.cardId;
  const [budget, setBudgetState] = useState<Budget>(BUDGET);
  const [rules, setRules] = useState<MerchantRule[]>(apiEnabled ? [] : MERCHANT_RULES);
  const [frozen, setFrozen] = useState(false);
  const [balance, setBalance] = useState(user.balance);
  const [accountNumber, setAccountNumber] = useState(ACCOUNT.number);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [saved, setSaved] = useState<Recipient[]>([]);
  const [draft, setDraft] = useState<TransferDraft | null>(null);
  const [status, setStatus] = useState<DataStatus>(apiEnabled ? 'loading' : 'mock');
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Txn[]>(apiEnabled ? [] : TRANSACTIONS);
  const [alerts, setAlerts] = useState<Alert[]>(apiEnabled ? [] : ALERTS);

  const load = useCallback(() => {
    fetchCardData().then(
      (data) => {
        setTransactions(data.transactions);
        setAlerts(data.alerts);
        setRules(toRules(data.controls));
        setBudgetState((b) => withControls(b, data.controls));
        setBalance(data.balance);
        setAccountNumber(data.accountNumber);
        setSaved(data.saved);
        setError(null);
        setStatus('ready');
      },
      (e: unknown) => {
        setError(message(e));
        setStatus('error');
      },
    );
  }, []);

  const reloadControls = useCallback(() => {
    fetchControls().then(
      (controls) => {
        setRules(toRules(controls));
        setBudgetState((b) => withControls(b, controls));
      },
      (e: unknown) => setError(message(e)),
    );
  }, []);

  useEffect(() => {
    if (apiEnabled) load();
  }, [load]);

  const refresh = useCallback(() => {
    if (!apiEnabled) return;
    setStatus('loading');
    load();
  }, [load]);

  const effectiveBudget = useMemo<Budget>(() => {
    if (!apiEnabled) return budget;
    const now = new Date();
    const spent = transactions
      .filter((t) => t.decision !== 'DECLINE')
      .filter((t) => {
        const d = new Date(t.ts);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, t) => sum + t.amount, 0);
    return { ...budget, spent: Math.round(spent * 100) / 100 };
  }, [budget, transactions]);

  const toggleFrozen = useCallback(() => setFrozen((f) => !f), []);

  const setBudget = useCallback(
    (limit: number, period: Period) => {
      setBudgetState((b) => ({ ...b, limit, period }));
      if (apiEnabled) commands.setBudget(limit, period).catch(reloadControls);
    },
    [reloadControls],
  );

  const setMerchantRule = useCallback(
    (merchant: string, type: RuleType) => {
      setRules((rs) => [
        { merchant, type, createdAt: new Date().toISOString(), pending: true },
        ...rs.filter((r) => r.merchant !== merchant),
      ]);
      const settle = () => setRules((rs) => rs.map((r) => (r.merchant === merchant ? { ...r, pending: false } : r)));
      if (!apiEnabled) {
        setTimeout(settle, PROPAGATION_MS);
        return;
      }
      commands.setMerchantRule(merchant, type).then(settle, reloadControls);
    },
    [reloadControls],
  );

  const releaseMerchant = useCallback(
    (merchant: string) => {
      setRules((rs) => rs.filter((r) => r.merchant !== merchant));
      if (apiEnabled) commands.releaseMerchant(merchant).catch(reloadControls);
    },
    [reloadControls],
  );

  const reloadSaved = useCallback(() => {
    fetchRecipients().then(setSaved, (e: unknown) => setError(message(e)));
  }, []);

  const lookupAccount = useCallback(
    async (bankCode: string, account: string) => {
      // Our own bank: a real account on this platform. Other banks stay mocked, there is no interbank link.
      if (apiEnabled && bankCode === ACCOUNT.bankCode) return fetchAccountHolder(account);
      await wait(LOOKUP_MS);
      if (account.length < 6) return null;
      const known = saved.find((r) => r.bankCode === bankCode && r.account === account);
      if (known) return known.name;
      const sum = [...account].reduce((acc, d) => acc + Number(d), 0);
      return LOOKUP_NAMES[sum % LOOKUP_NAMES.length];
    },
    [saved],
  );

  const sendTransfer = useCallback(async (d: TransferDraft, transferId: string, password: string) => {
    let transfer: Transfer;
    if (apiEnabled) {
      // The server checks the password, the balance and the recipient, and moves the money in one transaction.
      const { balance: after, ...posted } = await commands
        .sendTransfer({ transferId, to: d.to, amount: d.amount, content: d.content, password })
        .catch((e: unknown) => {
          throw transferError(e);
        });
      transfer = posted;
      setBalance(after);
    } else {
      await wait(TRANSFER_MS);
      if (password !== MOCK_PASSWORD) throw new TransferError('Incorrect password');
      const now = new Date();
      transfer = {
        transferId,
        reference: `FT${String(now.getTime()).slice(-10)}`,
        kind: d.kind,
        to: d.to,
        amount: d.amount,
        fee: 0,
        content: d.content,
        ts: now.toISOString(),
      };
      setBalance((b) => b - d.amount);
    }
    setTransfers((ts) => [transfer, ...ts.filter((t) => t.transferId !== transfer.transferId)]);
    if (d.save) {
      setSaved((rs) => (rs.some((r) => sameRecipient(r, d.to)) ? rs : [d.to, ...rs]));
      if (apiEnabled) commands.saveRecipient(d.to).catch(reloadSaved);
    }
    return transfer;
  }, [reloadSaved]);

  const removeSaved = useCallback(
    (recipient: Recipient) => {
      setSaved((rs) => rs.filter((r) => !sameRecipient(r, recipient)));
      if (apiEnabled) commands.removeRecipient(recipient).catch(reloadSaved);
    },
    [reloadSaved],
  );

  const value = useMemo<Store>(
    () => ({
      status,
      error,
      cardId,
      refresh,
      transactions,
      alerts,
      budget: effectiveBudget,
      rules,
      frozen,
      balance,
      accountNumber,
      banks: BANKS,
      saved,
      transfers,
      draft,
      toggleFrozen,
      setBudget,
      setMerchantRule,
      releaseMerchant,
      ruleFor: (merchant) => rules.find((r) => r.merchant === merchant),
      setDraft,
      lookupAccount,
      sendTransfer,
      removeSaved,
    }),
    [status, error, cardId, refresh, transactions, alerts, effectiveBudget, rules, frozen, balance, accountNumber, saved, transfers, draft, toggleFrozen, setBudget, setMerchantRule, releaseMerchant, lookupAccount, sendTransfer, removeSaved],
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
