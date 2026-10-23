export type User = {
  id: string;
  name: string;
  email: string;
  memberSince: string;
  cardId: string;
  balance: number;
};

export const USERS: User[] = [
  {
    id: 'u-1',
    name: 'Jamie Carter',
    email: 'jamie@example.com',
    memberSince: '2021',
    cardId: '180048185037117',
    balance: 125_450_000,
  },
  {
    id: 'u-2',
    name: 'Riley Nguyen',
    email: 'riley@example.com',
    memberSince: '2019',
    cardId: '4653879239169997',
    balance: 48_300_000,
  },
];

export function initialUserId(): string {
  const card = process.env.EXPO_PUBLIC_CARD_ID;
  return USERS.find((u) => u.cardId === card)?.id ?? USERS[0].id;
}

export function userById(id: string): User {
  return USERS.find((u) => u.id === id) ?? USERS[0];
}
