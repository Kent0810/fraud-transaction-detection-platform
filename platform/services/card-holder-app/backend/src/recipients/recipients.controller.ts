import { Body, Controller, Delete, Get, HttpCode, Param, Put } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { CardIdPipe } from '../common/validation';
import { RemoveRecipientCommand } from './commands/remove-recipient.command';
import { SaveRecipientCommand } from './commands/save-recipient.command';
import { GetRecipientsQuery } from './queries/get-recipients.query';
import { account, bankCode, parseRecipientName, type RecipientDto } from './recipients.types';

@Controller('cards/:cardId/recipients')
export class RecipientsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get()
  recipients(@Param('cardId', CardIdPipe) cardId: string): Promise<RecipientDto[]> {
    return this.queries.execute(new GetRecipientsQuery(cardId));
  }

  // PUT: saving the same recipient twice is a no-op, so a retry is safe.
  @Put(':bankCode/:account')
  save(
    @Param('cardId', CardIdPipe) cardId: string,
    @Param('bankCode') bank: string,
    @Param('account') acct: string,
    @Body() body: unknown,
  ): Promise<RecipientDto> {
    return this.commands.execute(new SaveRecipientCommand(cardId, bankCode(bank), account(acct), parseRecipientName(body)));
  }

  @Delete(':bankCode/:account')
  @HttpCode(204)
  remove(
    @Param('cardId', CardIdPipe) cardId: string,
    @Param('bankCode') bank: string,
    @Param('account') acct: string,
  ): Promise<void> {
    return this.commands.execute(new RemoveRecipientCommand(cardId, bankCode(bank), account(acct)));
  }
}
