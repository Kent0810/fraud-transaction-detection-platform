import { Body, Controller, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { Public, SessionToken } from '../../common/decorators/session.decorator';
import { ZodPipe } from '../../common/validation';
import { LoginRequest, type SessionDto } from './types/auth.types';
import { LoginCommand } from './commands/login.command';
import { LogoutCommand } from './commands/logout.command';

@Controller('auth')
export class AuthController {
  constructor(private readonly commands: CommandBus) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodPipe(LoginRequest)) { cardId, password }: LoginRequest): Promise<SessionDto> {
    const session = await this.commands.execute(new LoginCommand(cardId, password));
    // Same error for an unknown card, a wrong password and a locked login, so login can't be used to probe card numbers.
    if (!session) throw new UnauthorizedException('incorrect card number or password');
    return session;
  }

  @Post('logout')
  @HttpCode(204)
  logout(@SessionToken() token: string): Promise<void> {
    return this.commands.execute(new LogoutCommand(token));
  }
}
