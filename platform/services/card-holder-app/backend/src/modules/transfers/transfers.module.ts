import { Module } from '@nestjs/common';

import { SendTransferHandler } from './commands/send-transfer.command';
import { SettleTransferHandler } from './commands/settle-transfer.command';
import { TransferDecisionsConsumer } from './consumers/transfer-decisions.consumer';
import { GetTransferHandler } from './queries/get-transfer.query';
import { TransfersRepository } from './repositories/transfers.repository';
import { TransfersController } from './transfers.controller';

@Module({
  controllers: [TransfersController],
  providers: [
    TransfersRepository,
    SendTransferHandler,
    SettleTransferHandler,
    GetTransferHandler,
    TransferDecisionsConsumer,
  ],
})
export class TransfersModule {}
