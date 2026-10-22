import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../../../shared/presentation/http/decorators/public.decorator.js';
import { InvalidTokenError } from '../../../application/errors/invalid-token.error.js';
import { ValidateAccessTokenUseCase } from '../../../application/use-cases/validate-access-token.use-case.js';
import type { AuthenticatedRequest } from '../authenticated-request.js';

/** Guard global: toda rota exige access token, salvo as marcadas com @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly validateAccessToken: ValidateAccessTokenUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new InvalidTokenError();
    }

    request.user = await this.validateAccessToken.execute(token);

    return true;
  }
}

function extractBearerToken(header: string | undefined): string | null {
  const [scheme, token, ...rest] = header?.split(' ') ?? [];

  return scheme?.toLowerCase() === 'bearer' && token && rest.length === 0
    ? token
    : null;
}
