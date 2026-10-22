import { Module } from '@nestjs/common';

import { CardsController } from './cards.controller';
import { CardsRepository } from './cards.repository';

@Module({
  controllers: [CardsController],
  providers: [CardsRepository],
})
export class CardsModule {}
