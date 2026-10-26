import { Body, Controller, Delete, Get, HttpCode, Param, Put } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { CurrentCard } from '../../common/decorators/session.decorator';
import { ZodPipe } from '../../common/validation';
import { ReleaseMerchantCommand } from './commands/release-merchant.command';
import { SetBudgetCommand } from './commands/set-budget.command';
import { SetMerchantRuleCommand } from './commands/set-merchant-rule.command';
import {
  type BudgetDto,
  BudgetRequest,
  type ControlsDto,
  Merchant,
  type MerchantRuleDto,
  MerchantRuleRequest,
} from './controls.types';
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

  @Put('budget')
  @HttpCode(202)
  setBudget(@CurrentCard() cardId: string, @Body(new ZodPipe(BudgetRequest)) { limit, period }: BudgetRequest): Promise<BudgetDto> {
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
  releaseMerchant(@CurrentCard() cardId: string, @Param('merchant', new ZodPipe(Merchant)) merchant: string): Promise<void> {
    return this.commands.execute(new ReleaseMerchantCommand(cardId, merchant));
  }
}
