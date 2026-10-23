export type User = {
  name: string;
  email: string;
  memberSince: string;
  cardId: string;
  balance: number;
};

export function userFor(cardId: string, name: string): User {
  return {
    name,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    memberSince: '2021',
    cardId,
    balance: 100_000_000,
  };
}
