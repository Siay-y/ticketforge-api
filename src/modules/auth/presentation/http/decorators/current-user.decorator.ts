import {
  createParamDecorator,
  type ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../../application/dtos/authenticated-user.js';
import type { AuthenticatedRequest } from '../authenticated-request.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Só acontece se a rota for @Public: erro de programação, não do cliente.
    if (!user) {
      throw new InternalServerErrorException(
        '@CurrentUser() usado em rota sem autenticação',
      );
    }

    return user;
  },
);
