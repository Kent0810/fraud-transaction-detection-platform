import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { CasesRepository } from '../../repositories/cases.repository';
import type { FlaggedPaymentDto } from '../../types/ops.types';
import { GetFlaggedPaymentsQuery } from '../queries/get-flagged-payments.query';

@QueryHandler(GetFlaggedPaymentsQuery)
export class GetFlaggedPaymentsHandler implements IQueryHandler<GetFlaggedPaymentsQuery> {
  constructor(private readonly cases: CasesRepository) {}

  execute({ hours }: GetFlaggedPaymentsQuery): Promise<FlaggedPaymentDto[]> {
    return this.cases.flaggedPayments(hours);
  }
}
