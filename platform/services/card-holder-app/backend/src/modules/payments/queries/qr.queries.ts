import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { QrRepository } from '../repositories/qr.repository';
import type { MerchantQrDto, MerchantRefDto, MyQrDto, QrTargetDto } from '../types/payments.types';

export class GetMyQrQuery extends Query<MyQrDto> {
  constructor(readonly cardId: string) {
    super();
  }
}

@QueryHandler(GetMyQrQuery)
export class GetMyQrHandler implements IQueryHandler<GetMyQrQuery> {
  constructor(private readonly qr: QrRepository) {}

  execute({ cardId }: GetMyQrQuery): Promise<MyQrDto> {
    return this.qr.mine(cardId);
  }
}

export class ResolveQrQuery extends Query<QrTargetDto> {
  constructor(
    readonly cardId: string,
    readonly payload: string,
  ) {
    super();
  }
}

@QueryHandler(ResolveQrQuery)
export class ResolveQrHandler implements IQueryHandler<ResolveQrQuery> {
  constructor(private readonly qr: QrRepository) {}

  execute({ cardId, payload }: ResolveQrQuery): Promise<QrTargetDto> {
    return this.qr.resolve(cardId, payload);
  }
}

export class SearchMerchantsQuery extends Query<MerchantRefDto[]> {
  constructor(readonly query: string | undefined) {
    super();
  }
}

@QueryHandler(SearchMerchantsQuery)
export class SearchMerchantsHandler implements IQueryHandler<SearchMerchantsQuery> {
  constructor(private readonly qr: QrRepository) {}

  execute({ query }: SearchMerchantsQuery): Promise<MerchantRefDto[]> {
    return Promise.resolve(this.qr.search(query));
  }
}

// A query, not a command: issuing a code changes nothing; the code is checked when it is paid.
export class MerchantQrQuery extends Query<MerchantQrDto> {
  constructor(
    readonly merchantId: string,
    readonly amount: number | null,
  ) {
    super();
  }
}

@QueryHandler(MerchantQrQuery)
export class MerchantQrHandler implements IQueryHandler<MerchantQrQuery> {
  constructor(private readonly qr: QrRepository) {}

  execute({ merchantId, amount }: MerchantQrQuery): Promise<MerchantQrDto> {
    return Promise.resolve(this.qr.merchantCode(merchantId, amount));
  }
}
