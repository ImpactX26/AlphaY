import { CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { type AuthUser, verifyToken } from '../auth/jwt';

/** Routes that need no token: sign-in, demo logins, system status. */
export const Public = () => SetMetadata('public', true);

/** Staff-only routes (the whole command centre). */
export const StaffOnly = () => SetMetadata('staffOnly', true);

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

/**
 * Bearer token in the header, or `?token=` for links the browser loads itself
 * (<img>, <video>, PDF and .ics downloads cannot send headers).
 */
function tokenFrom(req: AuthedRequest): string {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const q = req.query?.token;
  return typeof q === 'string' ? q : '';
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const handler = ctx.getHandler();
    const cls = ctx.getClass();
    if (this.reflector.getAllAndOverride<boolean>('public', [handler, cls])) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const user = verifyToken(tokenFrom(req));
    if (!user) throw new UnauthorizedException('Sign in to continue.');
    req.user = user;

    if (this.reflector.getAllAndOverride<boolean>('staffOnly', [handler, cls]) && user.role !== 'staff') {
      throw new ForbiddenException('Staff only.');
    }
    return true;
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.user) throw new UnauthorizedException('Sign in to continue.');
  return req.user;
});

/**
 * The contract's access rule in one place: an applicant may only touch their own id,
 * staff may touch any. Every applicant-scoped controller calls this.
 */
export function assertCanSee(user: AuthUser, applicantId: string): void {
  if (user.role === 'staff') return;
  if (user.applicantId && user.applicantId === applicantId) return;
  throw new ForbiddenException('That is not your application.');
}
