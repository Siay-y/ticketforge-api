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

    // Sem usuário também nega (fail-closed).
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('Permissão insuficiente para este recurso');
    }

    return true;
  }
}
