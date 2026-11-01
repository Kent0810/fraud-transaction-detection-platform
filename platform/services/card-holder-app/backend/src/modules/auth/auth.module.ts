import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthController } from './auth.controller';
import { SessionGuard } from './guards/session.guard';
import { LoginHandler } from './handlers/command-handlers/login.handler';
import { LogoutHandler } from './handlers/command-handlers/logout.handler';
import { CardholdersRepository } from './repositories/cardholders.repository';
import { SessionsRepository } from './repositories/sessions.repository';

@Module({
  controllers: [AuthController],
  providers: [
    CardholdersRepository,
    SessionsRepository,
    LoginHandler,
    LogoutHandler,
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AuthModule {}
