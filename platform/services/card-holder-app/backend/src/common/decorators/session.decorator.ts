import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

export const PUBLIC = 'public';

/** Opts a route out of the session guard (login, health). Every other route needs a session. */
export const Public = () => SetMetadata(PUBLIC, true);

export type SessionRequest = Request & { cardId?: string; sessionToken?: string };

/** The signed-in card, from the session token. Never from the URL or the body, so one user can't name another's card. */
export const CurrentCard = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const cardId = ctx.switchToHttp().getRequest<SessionRequest>().cardId;
  if (!cardId) throw new Error('CurrentCard used on a route without the session guard');
  return cardId;
});

export const SessionToken = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | undefined =>
    ctx.switchToHttp().getRequest<SessionRequest>().sessionToken,
);
