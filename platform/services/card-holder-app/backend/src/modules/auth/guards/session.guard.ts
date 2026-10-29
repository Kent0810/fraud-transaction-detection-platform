import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PUBLIC, type SessionRequest } from '../../../common/decorators/session.decorator';
import { STAFF_ROLES, type StaffRole } from '../../../common/decorators/staff.decorator';
import { SessionsRepository } from '../repositories/sessions.repository';

const BEARER = /^Bearer ([A-Za-z0-9_-]{20,200})$/;

// Registered globally: a new route is protected unless it is marked @Public(). @Staff() routes are StaffGuard's.
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsRepository,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, targets)) return true;
    if (this.reflector.getAllAndOverride<StaffRole[]>(STAFF_ROLES, targets)) return true;
    const req = ctx.switchToHttp().getRequest<SessionRequest>();
    const token = BEARER.exec(req.headers.authorization ?? '')?.[1];
    const cardId = token ? await this.sessions.cardFor(token) : null;
    if (!token || !cardId) throw new UnauthorizedException('sign in again');
    req.cardId = cardId;
    req.sessionToken = token;
    return true;
  }
}
