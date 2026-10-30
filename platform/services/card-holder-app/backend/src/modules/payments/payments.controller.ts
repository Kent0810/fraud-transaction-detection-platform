import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { CurrentCard } from '../../common/decorators/session.decorator';
import { ZodPipe } from '../../common/validation';
import { SendPaymentCommand } from './commands/send-payment.command';
import { GetMerchantsQuery } from './queries/get-merchants.query';
import { GetPaymentQuery } from './queries/get-payment.query';
import { type MerchantDto, type PaymentDto, PaymentId, PaymentRequest } from './types/payments.types';

@Controller('me/payments')
export class PaymentsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get('merchants')
  merchants(@CurrentCard() cardId: string): Promise<MerchantDto[]> {
    return this.queries.execute(new GetMerchantsQuery(cardId));
  }

  // POST with a client-made paymentId: retrying after a timeout returns the same payment instead of paying twice.
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  pay(@CurrentCard() cardId: string, @Body(new ZodPipe(PaymentRequest)) body: PaymentRequest): Promise<PaymentDto> {
    return this.commands.execute(new SendPaymentCommand(cardId, body));
  }

  @Get(':paymentId')
  async get(
    @CurrentCard() cardId: string,
    @Param('paymentId', new ZodPipe(PaymentId)) paymentId: string,
  ): Promise<PaymentDto> {
    const payment = await this.queries.execute(new GetPaymentQuery(cardId, paymentId));
    if (!payment) throw new NotFoundException('payment not found');
    return payment;
  }
}
