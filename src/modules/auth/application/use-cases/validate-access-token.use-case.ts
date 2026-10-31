import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../dtos/authenticated-user.js';
import { InvalidTokenError } from '../errors/invalid-token.error.js';
import { SessionStore } from '../ports/session-store.js';
import { TokenService } from '../ports/token-service.js';

@Injectable()
export class ValidateAccessTokenUseCase {
  constructor(
    private readonly tokens: TokenService,
    private readonly sessions: SessionStore,
  ) {}

  /** Exige sessão ativa além da assinatura: é o que torna o logout imediato. */
  async execute(accessToken: string): Promise<AuthenticatedUser> {
    const user = await this.tokens.verifyAccessToken(accessToken);

    if (!(await this.sessions.isActive(user.sessionId))) {
      throw new InvalidTokenError();
    }

    return user;
  }
}
