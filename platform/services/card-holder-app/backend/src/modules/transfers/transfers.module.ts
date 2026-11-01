import { Module } from '@nestjs/common';

import { SettleConsumer } from './consumers/settle.consumer';
import { SendTransferHandler } from './handlers/command-handlers/send-transfer.handler';
import { SettleHandler } from './handlers/command-handlers/settle.handler';
import { GetTransferHandler } from './handlers/query-handlers/get-transfer.handler';
import { TransfersRepository } from './repositories/transfers.repository';
import { TransfersController } from './transfers.controller';

@Module({
  controllers: [TransfersController],
  providers: [TransfersRepository, SendTransferHandler, SettleHandler, GetTransferHandler, SettleConsumer],
})
export class TransfersModule {}
