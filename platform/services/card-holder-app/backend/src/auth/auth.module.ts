import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { CardholdersRepository } from './cardholders.repository';
import { LoginHandler } from './commands/login.command';

@Module({
  controllers: [AuthController],
  providers: [CardholdersRepository, LoginHandler],
})
export class AuthModule {}
