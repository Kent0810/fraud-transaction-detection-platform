// Whole units of the currency's minor unit; for VND, đồng.
export type BalanceDto = {
  cardId: string;
  accountNumber: string;
  balance: number;
  currency: string;
  updatedAt: string;
};

// What a sender sees before transferring: the holder's name, as banks print it (upper case), and nothing else.
export type AccountHolderDto = { accountNumber: string; name: string };
