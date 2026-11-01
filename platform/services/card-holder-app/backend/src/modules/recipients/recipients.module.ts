import { Module } from '@nestjs/common';

import { RemoveRecipientHandler } from './handlers/command-handlers/remove-recipient.handler';
import { SaveRecipientHandler } from './handlers/command-handlers/save-recipient.handler';
import { GetRecipientsHandler } from './handlers/query-handlers/get-recipients.handler';
import { RecipientsController } from './recipients.controller';
import { RecipientsRepository } from './repositories/recipients.repository';

@Module({
  controllers: [RecipientsController],
  providers: [RecipientsRepository, GetRecipientsHandler, SaveRecipientHandler, RemoveRecipientHandler],
})
export class RecipientsModule {}
