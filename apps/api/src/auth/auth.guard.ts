import { CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyToken, type AuthUser } from './jwt';

export const PUBLIC = 'public';
export const Public = () => SetMetadata(PUBLIC, true);
export const ROLES = 'roles';
export const Roles = (...roles: AuthUser['role'][]) => SetMetadata(ROLES, roles);

/** Bearer token, or ?token= for file links in <img>, <video> and downloads. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    const header = String(req.headers.authorization ?? '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : String(req.query?.token ?? '');
    const user = token ? verifyToken(token) : null;
    if (!user) throw new UnauthorizedException();
    req.user = user;
    const roles = this.reflector.getAllAndOverride<AuthUser['role'][]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(user.role)) throw new ForbiddenException();
    return true;
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);

/** Applicants may only touch their own id; staff may touch any. */
export function assertAccess(user: AuthUser, applicantId: string) {
  if (user.role === 'staff') return;
  if (user.role === 'applicant' && user.applicantId === applicantId) return;
  throw new ForbiddenException();
}
