import { Module } from '@nestjs/common';

import { SendTransferHandler } from './commands/send-transfer.command';
import { TransfersRepository } from './repositories/transfers.repository';
import { TransfersController } from './transfers.controller';

@Module({
  controllers: [TransfersController],
  providers: [TransfersRepository, SendTransferHandler],
})
export class TransfersModule {}
