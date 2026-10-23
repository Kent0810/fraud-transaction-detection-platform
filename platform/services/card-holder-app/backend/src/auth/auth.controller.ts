import { Body, Controller, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { parseLogin, type SessionDto } from './auth.types';
import { LoginCommand } from './commands/login.command';

@Controller('auth')
export class AuthController {
  constructor(private readonly commands: CommandBus) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown): Promise<SessionDto> {
    const { cardId, password } = parseLogin(body);
    const session = await this.commands.execute(new LoginCommand(cardId, password));
    // Same error for an unknown card, a wrong password and a locked login, so login can't be used to probe card numbers.
    if (!session) throw new UnauthorizedException('incorrect card number or password');
    return session;
  }
}
