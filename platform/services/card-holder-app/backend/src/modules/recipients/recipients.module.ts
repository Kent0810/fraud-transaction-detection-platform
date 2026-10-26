import { Module } from '@nestjs/common';

import { RemoveRecipientHandler } from './commands/remove-recipient.command';
import { SaveRecipientHandler } from './commands/save-recipient.command';
import { GetRecipientsHandler } from './queries/get-recipients.query';
import { RecipientsController } from './recipients.controller';
import { RecipientsRepository } from './repositories/recipients.repository';

@Module({
  controllers: [RecipientsController],
  providers: [RecipientsRepository, GetRecipientsHandler, SaveRecipientHandler, RemoveRecipientHandler],
})
export class RecipientsModule {}
