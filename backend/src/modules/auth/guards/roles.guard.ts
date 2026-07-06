import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Dijalankan setelah JwtAuthGuard (urutan didaftarkan di app.module.ts).
 * Jika endpoint tidak punya @Roles(), guard ini lolos begitu saja (tidak membatasi apapun).
 */
@Injectable()
export class RolesGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const userRoles: string[] = user?.role ?? [];

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException(
        `Akses ditolak — endpoint ini butuh role: ${requiredRoles.join(', ')}`,
      );
    }
    return true;
  }
}
