// Demo users, one per real card in events.csv. Names and emails are made up.
export type User = {
  id: string;
  name: string;
  email: string;
  memberSince: string;
  cardId: string; // cc_num in the stream, card_id in Cassandra
  balance: number; // mock VND balance of the payment account
};

export const USERS: User[] = [
  {
    id: 'u-1',
    name: 'Jamie Carter',
    email: 'jamie@example.com',
    memberSince: '2021',
    cardId: '180048185037117', // busiest card in the first 1,000 events
    balance: 125_450_000,
  },
  {
    id: 'u-2',
    name: 'Riley Nguyen',
    email: 'riley@example.com',
    memberSince: '2019',
    cardId: '4653879239169997', // has 14 fraud transactions later in the file
    balance: 48_300_000,
  },
];

// EXPO_PUBLIC_CARD_ID picks who you start as; otherwise the first user.
export function initialUserId(): string {
  const card = process.env.EXPO_PUBLIC_CARD_ID;
  return USERS.find((u) => u.cardId === card)?.id ?? USERS[0].id;
}

export function userById(id: string): User {
  return USERS.find((u) => u.id === id) ?? USERS[0];
}
