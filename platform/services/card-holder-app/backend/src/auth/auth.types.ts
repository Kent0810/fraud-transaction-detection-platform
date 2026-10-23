import { cardId, record, text } from '../common/validation';

export const DISPLAY_NAME = 'John Doe';

export type SessionDto = { cardId: string; name: string };

export type LoginRequest = { cardId: string; password: string };

export function parseLogin(body: unknown): LoginRequest {
  const b = record(body, 'body');
  return { cardId: cardId(b.cardId), password: text(b.password, 'password', 128) };
}
