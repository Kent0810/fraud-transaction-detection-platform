import { Injectable } from '@nestjs/common';

import { iso } from '../../../shared/cassandra/models';
import { auditEntry, type StaffAudit } from '../../../shared/prisma/audit';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { AccountDto, AuditEntryDto, CardholderDto, LoginDto, LoginStatus } from '../types/ops.types';

@Injectable()
export class CardholderFilesRepository {
  constructor(private readonly db: PrismaService) {}

  /** The card for a card number or an account number, as a caller would read it out. */
  async lookup(number: string): Promise<string | null> {
    const account = await this.db.client.accounts.findFirst({
      where: {
        OR: [{ card_id: number }, { account_number: number }],
      },
      select: { card_id: true },
    });
    return account?.card_id ?? null;
  }

  /** The owner's details and account. Every look is written to the audit log first. */
  async open(
    cardId: string,
    by: StaffAudit,
  ): Promise<{ holder: CardholderDto; account: AccountDto | null; login: LoginDto | null } | null> {
    const exists = await this.db.client.cardholders.count({ where: { card_id: cardId } });
    if (!exists) return null;

    await this.db.client.audit_log.createMany({ data: auditEntry(by, 'VIEW_CARDHOLDER', cardId) });

    const row = await this.db.client.cardholders.findUniqueOrThrow({
      where: { card_id: cardId },
      select: {
        first_name: true,
        last_name: true,
        email: true,
        city: true,
        state: true,
        dob: true,
        accounts: {
          select: {
            account_number: true,
            balance: true,
            currency: true,
            status: true,
          },
        },
        auth: {
          select: {
            status: true,
            failed_logins: true,
            last_login_at: true,
          },
        },
      },
    });
    return {
      holder: {
        name: `${row.first_name} ${row.last_name}`,
        email: row.email,
        city: row.city,
        state: row.state,
        dob: iso(row.dob)?.slice(0, 10) ?? null,
      },
      account: row.accounts
        ? {
            accountNumber: row.accounts.account_number,
            balance: Number(row.accounts.balance),
            currency: row.accounts.currency,
            frozen: row.accounts.status === 'FROZEN',
          }
        : null,
      login: row.auth
        ? {
            status: row.auth.status as LoginStatus,
            failedLogins: row.auth.failed_logins,
            lastLoginAt: iso(row.auth.last_login_at),
          }
        : null,
    };
  }

  async auditTrail(cardId: string, limit: number): Promise<AuditEntryDto[]> {
    const rows = await this.db.client.audit_log.findMany({
      where: { card_id: cardId },
      orderBy: { at: 'desc' },
      take: limit,
      select: {
        audit_id: true,
        at: true,
        action: true,
        payload: true,
        staff: {
          select: {
            name: true,
            role: true,
          },
        },
      },
    });
    return rows.map((r) => ({
      auditId: r.audit_id.toString(),
      at: r.at.toISOString(),
      action: r.action,
      staffName: r.staff.name,
      staffRole: r.staff.role,
      payload: r.payload,
    }));
  }
}
