import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import { SessionsRepository } from './sessions.repository';

const BEARER = /^Bearer ([A-Za-z0-9_-]{20,200})$/;

export type CardRequest = Request & { cardId?: string };

const token = (ctx: ExecutionContext) =>
  BEARER.exec(ctx.switchToHttp().getRequest<Request>().headers.authorization ?? '')?.[1];

@Injectable()
export class CardholderGuard implements CanActivate {
  constructor(private readonly sessions: SessionsRepository) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const t = token(ctx);
    const cardId = t ? await this.sessions.cardFor(t) : null;
    if (!cardId) throw new UnauthorizedException('sign in again');
    ctx.switchToHttp().getRequest<CardRequest>().cardId = cardId;
    return true;
  }
}

@Injectable()
export class StaffGuard implements CanActivate {
  constructor(private readonly sessions: SessionsRepository) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const t = token(ctx);
    if (!t || !(await this.sessions.isStaff(t))) throw new UnauthorizedException('sign in again');
    return true;
  }
}
