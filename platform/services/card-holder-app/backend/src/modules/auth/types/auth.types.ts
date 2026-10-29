import { z } from 'zod';

import { CardId, Password } from '../../../common/validation';

// token goes in `Authorization: Bearer <token>` on every other request.
export type SessionDto = {
  token: string;
  expiresAt: string;
  cardId: string;
  name: string;
  email: string;
};

export const LoginRequest = z.object({ cardId: CardId, password: Password });
export type LoginRequest = z.infer<typeof LoginRequest>;
