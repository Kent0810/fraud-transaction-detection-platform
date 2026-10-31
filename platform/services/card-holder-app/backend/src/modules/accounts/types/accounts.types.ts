// Whole units of the currency's minor unit; for VND, đồng.
export type BalanceDto = {
  cardId: string;
  accountNumber: string;
  balance: number;
  currency: string;
  updatedAt: string;
};

// What a sender sees before transferring: the holder's name, as banks print it (upper case), and nothing else.
export type AccountHolderDto = {
  accountNumber: string;
  name: string;
};

// The signed-in cardholder's own details, for the app's Personal information screen. Never another card's.
export type ProfileDto = {
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
