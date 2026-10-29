import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { CurrentCard } from '../../common/decorators/session.decorator';
import { ZodPipe } from '../../common/validation';
import { FreezeCardCommand } from './commands/freeze-card.command';
import { ReleaseMerchantCommand } from './commands/release-merchant.command';
import { SetBudgetCommand } from './commands/set-budget.command';
import { SetMerchantRuleCommand } from './commands/set-merchant-rule.command';
import { UnfreezeCardCommand } from './commands/unfreeze-card.command';
import {
  type BudgetDto,
  BudgetRequest,
  type CardStatusDto,
  type ControlsDto,
  Merchant,
  type MerchantRuleDto,
  MerchantRuleRequest,
  UnfreezeRequest,
} from './types/controls.types';
import { GetCardStatusQuery } from './queries/get-card-status.query';
import { GetControlsQuery } from './queries/get-controls.query';

@Controller('me')
export class ControlsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get('controls')
  controls(@CurrentCard() cardId: string): Promise<ControlsDto> {
    return this.queries.execute(new GetControlsQuery(cardId));
  }

  @Get('card')
  cardStatus(@CurrentCard() cardId: string): Promise<CardStatusDto> {
    return this.queries.execute(new GetCardStatusQuery(cardId));
  }

  // 200, not 202 like the controls below: the freeze is saved, and blocks transfers, before the response.
  @Post('card/freeze')
  @HttpCode(200)
  freeze(@CurrentCard() cardId: string): Promise<CardStatusDto> {
    return this.commands.execute(new FreezeCardCommand(cardId));
  }

  @Post('card/unfreeze')
  @HttpCode(200)
  unfreeze(
    @CurrentCard() cardId: string,
    @Body(new ZodPipe(UnfreezeRequest)) { password }: UnfreezeRequest,
  ): Promise<CardStatusDto> {
    return this.commands.execute(new UnfreezeCardCommand(cardId, password));
  }

  @Put('budget')
  @HttpCode(202)
  setBudget(
    @CurrentCard() cardId: string,
    @Body(new ZodPipe(BudgetRequest)) { limit, period }: BudgetRequest,
  ): Promise<BudgetDto> {
    return this.commands.execute(new SetBudgetCommand(cardId, limit, period));
  }

  @Put('merchant-rules/:merchant')
  @HttpCode(202)
  setMerchantRule(
    @CurrentCard() cardId: string,
    @Param('merchant', new ZodPipe(Merchant)) merchant: string,
    @Body(new ZodPipe(MerchantRuleRequest)) { type }: MerchantRuleRequest,
  ): Promise<MerchantRuleDto> {
    return this.commands.execute(new SetMerchantRuleCommand(cardId, merchant, type));
  }

  @Delete('merchant-rules/:merchant')
  @HttpCode(202)
  releaseMerchant(
    @CurrentCard() cardId: string,
    @Param('merchant', new ZodPipe(Merchant)) merchant: string,
  ): Promise<void> {
    return this.commands.execute(new ReleaseMerchantCommand(cardId, merchant));
  }
}
