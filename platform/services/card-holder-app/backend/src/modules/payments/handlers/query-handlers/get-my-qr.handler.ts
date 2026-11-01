import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { QrRepository } from '../../repositories/qr.repository';
import type { MyQrDto } from '../../types/payments.types';
import { GetMyQrQuery } from '../queries/get-my-qr.query';

@QueryHandler(GetMyQrQuery)
export class GetMyQrHandler implements IQueryHandler<GetMyQrQuery> {
  constructor(private readonly qr: QrRepository) {}

  execute({ cardId }: GetMyQrQuery): Promise<MyQrDto> {
    return this.qr.mine(cardId);
  }
}
