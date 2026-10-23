import { createHash, timingSafeEqual } from 'node:crypto';

import { Body, Controller, HttpCode, Inject, Post, UnauthorizedException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

import { CardExistsQuery } from '../cards/queries/card-exists.query';
import type { Config } from '../config';
import { CONFIG } from '../config.module';
import { DISPLAY_NAME, parseLogin, type SessionDto } from './auth.types';

const digest = (s: string) => createHash('sha256').update(s).digest();

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(CONFIG) private readonly cfg: Config,
    private readonly queries: QueryBus,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown): Promise<SessionDto> {
    const { cardId, password } = parseLogin(body);
    const passwordOk = timingSafeEqual(digest(password), digest(this.cfg.loginPassword));
    // Same error for an unknown card and a wrong password, so login can't be used to probe card numbers.
    if (!passwordOk || !(await this.queries.execute(new CardExistsQuery(cardId)))) {
      throw new UnauthorizedException('incorrect card number or password');
    }
    return { cardId, name: DISPLAY_NAME };
  }
}
