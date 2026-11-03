import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { CurrentCard } from '../../common/decorators/session.decorator';
import { ZodPipe } from '../../common/validation';
import { FreezeCardCommand } from './handlers/commands/freeze-card.command';
import { SetBudgetCommand } from './handlers/commands/set-budget.command';
import { UnfreezeCardCommand } from './handlers/commands/unfreeze-card.command';
import { GetCardStatusQuery } from './handlers/queries/get-card-status.query';
import { GetControlsQuery } from './handlers/queries/get-controls.query';
import {
  type BudgetDto,
  BudgetRequest,
  type CardStatusDto,
  type ControlsDto,
  UnfreezeRequest,
} from './types/controls.types';

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

  // 200, not 202 like the budget below: the freeze is saved, and blocks transfers, before the response.
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
}
