import { Injectable } from '@nestjs/common';

import { iso } from '../../../shared/cassandra/models';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { RecipientDto } from '../types/recipients.types';

type RecipientRow = {
  bank_code: string;
  account: string;
  name: string;
  created_at: Date;
};

const columns = {
  bank_code: true,
  account: true,
  name: true,
  created_at: true,
} as const;

const toDto = (r: RecipientRow): RecipientDto => ({
  bankCode: r.bank_code,
  account: r.account,
  name: r.name,
  createdAt: iso(r.created_at) ?? '',
});

@Injectable()
export class RecipientsRepository {
  constructor(private readonly db: PrismaService) {}

  async forCard(cardId: string): Promise<RecipientDto[]> {
    const rows = await this.db.client.saved_recipients.findMany({
      where: { card_id: cardId },
      orderBy: { created_at: 'desc' },
      select: columns,
    });
    return rows.map(toDto);
  }

  /** Saves, or renames if already saved. Keeps the original created_at so the list order stays put. */
  async save(cardId: string, bankCode: string, account: string, name: string): Promise<RecipientDto> {
    const row = await this.db.client.saved_recipients.upsert({
      where: {
        card_id_bank_code_account: {
          card_id: cardId,
          bank_code: bankCode,
          account,
        },
      },
      create: {
        card_id: cardId,
        bank_code: bankCode,
        account,
        name,
      },
      update: { name },
      select: columns,
    });
    return toDto(row);
  }

  async remove(cardId: string, bankCode: string, account: string): Promise<void> {
    await this.db.client.saved_recipients.deleteMany({
      where: {
        card_id: cardId,
        bank_code: bankCode,
        account,
      },
    });
  }
}
