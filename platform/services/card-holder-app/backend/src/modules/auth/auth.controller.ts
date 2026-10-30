import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
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
    const result = await this.commands.execute(new LoginCommand(cardId, password));
    // Same error for an unknown card and a wrong password, so login can't be used to probe card numbers. A locked or
    // disabled login is only revealed to someone who knows the password.
    switch (result.outcome) {
      case 'OK':
        return result.session;
      case 'LOCKED':
        throw new HttpException('too many wrong passwords; sign-in is locked', HttpStatus.LOCKED);
      case 'DISABLED':
        throw new ForbiddenException('sign-in is turned off for this card');
      default:
        throw new UnauthorizedException('incorrect card number or password');
    }
  }

  @Post('logout')
  @HttpCode(204)
  logout(@SessionToken() token: string): Promise<void> {
    return this.commands.execute(new LogoutCommand(token));
  }
}
