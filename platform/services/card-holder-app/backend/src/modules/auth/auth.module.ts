import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthController } from './auth.controller';
import { LoginHandler } from './commands/login.command';
import { LogoutHandler } from './commands/logout.command';
import { SessionGuard } from './guards/session.guard';
import { CardholdersRepository } from './repositories/cardholders.repository';
import { SessionsRepository } from './repositories/sessions.repository';

@Module({
  controllers: [AuthController],
  providers: [CardholdersRepository, SessionsRepository, LoginHandler, LogoutHandler, { provide: APP_GUARD, useClass: SessionGuard }],
})
export class AuthModule {}
