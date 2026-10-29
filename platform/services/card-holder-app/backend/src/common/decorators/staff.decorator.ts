import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

export const STAFF_ROLES = 'staffRoles';

export const STAFF_ROLE_LIST = ['ANALYST', 'AGENT'] as const;
export type StaffRole = (typeof STAFF_ROLE_LIST)[number];

export type StaffMember = {
  staffId: number;
  name: string;
  email: string;
  role: StaffRole;
};

/** A console route: needs a staff session instead of a cardholder one, and one of these roles (any role if none). */
export const Staff = (...roles: StaffRole[]) => SetMetadata(STAFF_ROLES, roles.length ? roles : STAFF_ROLE_LIST);

export type StaffRequest = Request & { staff?: StaffMember; staffToken?: string };

export const CurrentStaff = createParamDecorator((_: unknown, ctx: ExecutionContext): StaffMember => {
  const staff = ctx.switchToHttp().getRequest<StaffRequest>().staff;
  if (!staff) throw new Error('CurrentStaff used on a route without @Staff()');
  return staff;
});

export const StaffToken = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | undefined => ctx.switchToHttp().getRequest<StaffRequest>().staffToken,
);
