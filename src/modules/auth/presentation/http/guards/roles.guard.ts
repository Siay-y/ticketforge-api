import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../../../../users/domain/value-objects/user-role.js';
import type { AuthenticatedRequest } from '../authenticated-request.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/** Roda depois do JwtAuthGuard. Sem @Roles(), qualquer usuário autenticado passa. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!roles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Sem usuário (rota @Public com @Roles) também nega: na dúvida, fecha.
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('Permissão insuficiente para este recurso');
    }

    return true;
  }
}
