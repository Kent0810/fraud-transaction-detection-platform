import { Body, Controller, Delete, Get, HttpCode, Param, Put } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { CardIdPipe } from '../common/validation';
import { ReleaseMerchantCommand } from './commands/release-merchant.command';
import { SetBudgetCommand } from './commands/set-budget.command';
import { SetMerchantRuleCommand } from './commands/set-merchant-rule.command';
import {
  type BudgetDto,
  type ControlsDto,
  type MerchantRuleDto,
  parseBudget,
  parseMerchant,
  parseRuleType,
} from './controls.types';
import { GetControlsQuery } from './queries/get-controls.query';

@Controller('cards/:cardId')
export class ControlsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get('controls')
  controls(@Param('cardId', CardIdPipe) cardId: string): Promise<ControlsDto> {
    return this.queries.execute(new GetControlsQuery(cardId));
  }

  @Put('budget')
  @HttpCode(202)
  setBudget(@Param('cardId', CardIdPipe) cardId: string, @Body() body: unknown): Promise<BudgetDto> {
    const { limit, period } = parseBudget(body);
    return this.commands.execute(new SetBudgetCommand(cardId, limit, period));
  }

  @Put('merchant-rules/:merchant')
  @HttpCode(202)
  setMerchantRule(
    @Param('cardId', CardIdPipe) cardId: string,
    @Param('merchant') merchant: string,
    @Body() body: unknown,
  ): Promise<MerchantRuleDto> {
    return this.commands.execute(new SetMerchantRuleCommand(cardId, parseMerchant(merchant), parseRuleType(body)));
  }

  @Delete('merchant-rules/:merchant')
  @HttpCode(202)
  releaseMerchant(@Param('cardId', CardIdPipe) cardId: string, @Param('merchant') merchant: string): Promise<void> {
    return this.commands.execute(new ReleaseMerchantCommand(cardId, parseMerchant(merchant)));
  }
}
