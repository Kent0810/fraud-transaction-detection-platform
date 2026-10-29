import { z } from 'zod';

import { text } from '../../../common/validation';

export type RecipientDto = {
  bankCode: string;
  account: string;
  name: string;
  createdAt: string;
};

export const RecipientName = z.object({ name: text(100) });
export type RecipientName = z.infer<typeof RecipientName>;
