import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import { ErrorResponse } from '../../../../../shared/presentation/http/error.response.js';
import type { UserRole } from '../../../../users/domain/value-objects/user-role.js';

export const ROLES_KEY = 'auth:roles';

export const Roles = (...roles: [UserRole, ...UserRole[]]) =>
  applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    ApiForbiddenResponse({
      description: `Exige o papel: ${roles.join(', ')}`,
      type: ErrorResponse,
    }),
  );
