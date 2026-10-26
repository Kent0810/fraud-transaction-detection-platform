import { Body, Controller, Delete, Get, HttpCode, Param, Put } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { CurrentCard } from '../../common/decorators/session.decorator';
import { AccountNumber, BankCode, ZodPipe } from '../../common/validation';
import { RemoveRecipientCommand } from './commands/remove-recipient.command';
import { SaveRecipientCommand } from './commands/save-recipient.command';
import { GetRecipientsQuery } from './queries/get-recipients.query';
import { type RecipientDto, RecipientName } from './recipients.types';

@Controller('me/recipients')
export class RecipientsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get()
  recipients(@CurrentCard() cardId: string): Promise<RecipientDto[]> {
    return this.queries.execute(new GetRecipientsQuery(cardId));
  }

  // PUT: saving the same recipient twice is a no-op, so a retry is safe.
  @Put(':bankCode/:account')
  save(
    @CurrentCard() cardId: string,
    @Param('bankCode', new ZodPipe(BankCode)) bankCode: string,
    @Param('account', new ZodPipe(AccountNumber)) account: string,
    @Body(new ZodPipe(RecipientName)) { name }: RecipientName,
  ): Promise<RecipientDto> {
    return this.commands.execute(new SaveRecipientCommand(cardId, bankCode, account, name));
  }

  @Delete(':bankCode/:account')
  @HttpCode(204)
  remove(
    @CurrentCard() cardId: string,
    @Param('bankCode', new ZodPipe(BankCode)) bankCode: string,
    @Param('account', new ZodPipe(AccountNumber)) account: string,
  ): Promise<void> {
    return this.commands.execute(new RemoveRecipientCommand(cardId, bankCode, account));
  }
}
