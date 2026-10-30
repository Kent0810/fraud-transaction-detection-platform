import { Module } from '@nestjs/common';

import { SendTransferHandler } from './commands/send-transfer.command';
import { SettleHandler } from './commands/settle.command';
import { SettleConsumer } from './consumers/settle.consumer';
import { GetTransferHandler } from './queries/get-transfer.query';
import { TransfersRepository } from './repositories/transfers.repository';
import { TransfersController } from './transfers.controller';

@Module({
  controllers: [TransfersController],
  providers: [TransfersRepository, SendTransferHandler, SettleHandler, GetTransferHandler, SettleConsumer],
})
export class TransfersModule {}
