import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { QrRepository } from '../../repositories/qr.repository';
import type { QrTargetDto } from '../../types/payments.types';
import { ResolveQrQuery } from '../queries/resolve-qr.query';

@QueryHandler(ResolveQrQuery)
export class ResolveQrHandler implements IQueryHandler<ResolveQrQuery> {
  constructor(private readonly qr: QrRepository) {}

  execute({ cardId, payload }: ResolveQrQuery): Promise<QrTargetDto> {
    return this.qr.resolve(cardId, payload);
  }
}
