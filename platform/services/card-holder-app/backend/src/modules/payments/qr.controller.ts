import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

import { CurrentCard } from '../../common/decorators/session.decorator';
import { Staff } from '../../common/decorators/staff.decorator';
import { ZodPipe } from '../../common/validation';
import { GetMyQrQuery, MerchantQrQuery, ResolveQrQuery, SearchMerchantsQuery } from './queries/qr.queries';
import {
  MerchantId,
  MerchantQrRequest,
  type MerchantQrDto,
  type MerchantRefDto,
  MerchantSearch,
  type MyQrDto,
  type QrTargetDto,
  ResolveQrRequest,
} from './types/payments.types';

@Controller()
export class QrController {
  constructor(private readonly queries: QueryBus) {}

  @Get('me/qr')
  mine(@CurrentCard() cardId: string): Promise<MyQrDto> {
    return this.queries.execute(new GetMyQrQuery(cardId));
  }

  // POST: the payload can be long and shouldn't land in access logs as a query string. Changes nothing.
  @Post('me/qr/resolve')
  @HttpCode(200)
  resolve(
    @CurrentCard() cardId: string,
    @Body(new ZodPipe(ResolveQrRequest)) body: ResolveQrRequest,
  ): Promise<QrTargetDto> {
    return this.queries.execute(new ResolveQrQuery(cardId, body.payload));
  }

  // The console's merchant terminal: the codes a merchant shows at the counter.
  @Staff()
  @Get('ops/merchants')
  merchants(@Query('q', new ZodPipe(MerchantSearch)) q: string | undefined): Promise<MerchantRefDto[]> {
    return this.queries.execute(new SearchMerchantsQuery(q));
  }

  @Staff()
  @Post('ops/merchants/:merchantId/qr')
  @HttpCode(200)
  merchantQr(
    @Param('merchantId', new ZodPipe(MerchantId)) merchantId: string,
    @Body(new ZodPipe(MerchantQrRequest)) body: MerchantQrRequest,
  ): Promise<MerchantQrDto> {
    return this.queries.execute(new MerchantQrQuery(merchantId, body.amount ?? null));
  }
}
