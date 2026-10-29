import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { STAFF_ROLES, type StaffRequest, type StaffRole } from '../../../common/decorators/staff.decorator';
import { StaffRepository } from '../repositories/staff.repository';

const BEARER = /^Bearer ([A-Za-z0-9_-]{20,200})$/;

// Registered globally next to SessionGuard; only acts on @Staff() routes.
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly staff: StaffRepository,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<StaffRole[]>(STAFF_ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!roles) return true;
    const req = ctx.switchToHttp().getRequest<StaffRequest>();
    const token = BEARER.exec(req.headers.authorization ?? '')?.[1];
    const member = token ? await this.staff.staffFor(token) : null;
    if (!token || !member) throw new UnauthorizedException('sign in again');
    if (!roles.includes(member.role)) throw new ForbiddenException(`not available to the ${member.role} role`);
    req.staff = member;
    req.staffToken = token;
    return true;
  }
}
