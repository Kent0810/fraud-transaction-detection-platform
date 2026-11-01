import { Injectable } from '@nestjs/common';

import { iso } from '../../../shared/cassandra/models';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { AccountHolderDto, BalanceDto, ProfileDto } from '../types/accounts.types';

@Injectable()
export class AccountsRepository {
  constructor(private readonly db: PrismaService) {}

  async balance(cardId: string): Promise<BalanceDto | null> {
    const row = await this.db.client.accounts.findUnique({
      where: { card_id: cardId },
      select: {
        account_number: true,
        balance: true,
        currency: true,
        updated_at: true,
      },
    });
    if (!row) return null;
    return {
      cardId,
      accountNumber: row.account_number,
      // Prisma returns bigint as BigInt; Number is exact up to 2^53, far above any demo balance.
      balance: Number(row.balance),
      currency: row.currency,
      updatedAt: iso(row.updated_at) ?? '',
    };
  }

  async profile(cardId: string): Promise<ProfileDto | null> {
    const row = await this.db.client.cardholders.findUnique({
      where: { card_id: cardId },
      select: {
        first_name: true,
        last_name: true,
        email: true,
        gender: true,
        dob: true,
        street: true,
        city: true,
        state: true,
        zip: true,
        job: true,
        created_at: true,
        accounts: { select: { account_number: true } },
      },
    });
    if (!row?.accounts) return null;
    const address = [row.street, row.city, [row.state, row.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return {
      cardId,
      accountNumber: row.accounts.account_number,
      name: `${row.first_name} ${row.last_name}`,
      email: row.email,
      gender: row.gender,
      dob: row.dob?.toISOString().slice(0, 10) ?? null,
      address: address || null,
      job: row.job,
      memberSince: row.created_at.toISOString(),
    };
  }

  async holder(accountNumber: string): Promise<AccountHolderDto | null> {
    const row = await this.db.client.accounts.findUnique({
      where: { account_number: accountNumber },
      select: {
        cardholders: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
    });
    if (!row) return null;
    const { first_name, last_name } = row.cardholders;
    return { accountNumber, name: `${first_name} ${last_name}`.toUpperCase() };
  }
}
