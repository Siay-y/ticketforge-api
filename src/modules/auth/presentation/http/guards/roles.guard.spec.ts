import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../../users/domain/value-objects/user-role.js';
import type { AuthenticatedUser } from '../../../application/dtos/authenticated-user.js';
import { RolesGuard } from './roles.guard.js';

const contextFor = (user?: AuthenticatedUser): ExecutionContext =>
  ({
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

const userWith = (role: UserRole): AuthenticatedUser => ({
  userId: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  role,
});

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  const requireRoles = (roles?: UserRole[]) =>
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

  afterEach(() => vi.restoreAllMocks());

  it('libera rota sem @Roles para qualquer autenticado', () => {
    requireRoles(undefined);

    expect(guard.canActivate(contextFor(userWith(UserRole.CUSTOMER)))).toBe(
      true,
    );
  });

  it('libera quem tem um dos papéis exigidos', () => {
    requireRoles([UserRole.ADMIN, UserRole.ORGANIZER]);

    expect(guard.canActivate(contextFor(userWith(UserRole.ORGANIZER)))).toBe(
      true,
    );
  });

  it('nega papel não autorizado com 403', () => {
    requireRoles([UserRole.ADMIN]);

    expect(() =>
      guard.canActivate(contextFor(userWith(UserRole.CUSTOMER))),
    ).toThrow(ForbiddenException);
  });

  it('nega quando não há usuário na requisição', () => {
    requireRoles([UserRole.ADMIN]);

    expect(() => guard.canActivate(contextFor())).toThrow(ForbiddenException);
  });
});
