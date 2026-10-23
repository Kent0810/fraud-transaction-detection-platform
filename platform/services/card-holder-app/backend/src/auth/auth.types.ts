import { cardId, record, text } from '../common/validation';

export type SessionDto = { cardId: string; name: string; email: string };

export type LoginRequest = { cardId: string; password: string };

export function parseLogin(body: unknown): LoginRequest {
  const b = record(body, 'body');
  return { cardId: cardId(b.cardId), password: text(b.password, 'password', 128) };
}
