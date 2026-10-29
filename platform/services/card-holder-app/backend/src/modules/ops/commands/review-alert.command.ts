import { NotFoundException } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { auditEntry, type StaffAudit } from '../../../shared/prisma/audit';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CasesRepository } from '../repositories/cases.repository';

export class ReviewAlertCommand extends Command<void> {
  constructor(
    readonly cardId: string,
    readonly alertId: string,
    readonly ts: string,
    readonly status: 'CONFIRMED' | 'CLEARED',
    readonly by: StaffAudit,
  ) {
    super();
  }
}

// Audited in Postgres first, then marked in Cassandra: an update, so a retry is harmless.
@CommandHandler(ReviewAlertCommand)
export class ReviewAlertHandler implements ICommandHandler<ReviewAlertCommand> {
  constructor(
    private readonly db: PrismaService,
    private readonly cases: CasesRepository,
  ) {}

  async execute({ cardId, alertId, ts, status, by }: ReviewAlertCommand): Promise<void> {
    const at = new Date(ts);
    if (!(await this.cases.alertExists(cardId, at, alertId))) throw new NotFoundException('alert not found');
    await this.db.client.audit_log.createMany({
      data: auditEntry(by, status === 'CONFIRMED' ? 'CONFIRM_ALERT' : 'CLEAR_ALERT', cardId, { alertId }),
    });
    await this.cases.setAlertStatus(cardId, at, alertId, status);
  }
}
