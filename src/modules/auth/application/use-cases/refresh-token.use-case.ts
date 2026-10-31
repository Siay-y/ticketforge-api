import { Injectable } from '@nestjs/common';
import type { UserView } from '../../../users/application/dtos/user.view.js';
import { GetUserProfileUseCase } from '../../../users/application/use-cases/get-user-profile.use-case.js';
import { UserNotFoundError } from '../../../users/domain/errors/user-not-found.error.js';
import type { AuthTokens } from '../dtos/auth-tokens.js';
import { InvalidTokenError } from '../errors/invalid-token.error.js';
import { RefreshTokenReuseError } from '../errors/refresh-token-reuse.error.js';
import { SessionStore } from '../ports/session-store.js';
import { TokenService } from '../ports/token-service.js';
import { SessionTokenIssuer } from '../services/session-token-issuer.js';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    private readonly tokens: TokenService,
    private readonly sessions: SessionStore,
    private readonly issuer: SessionTokenIssuer,
    private readonly getUserProfile: GetUserProfileUseCase,
  ) {}

  async execute(refreshToken: string): Promise<AuthTokens> {
    const claims = await this.tokens.verifyRefreshToken(refreshToken);
    const nextTokenId = crypto.randomUUID();

    // Troca antes de tudo: o token é consumido mesmo se algo falhar depois.
    const result = await this.sessions.rotate(
      {
        sessionId: claims.sessionId,
        expectedTokenId: claims.tokenId,
        nextTokenId,
      },
      this.tokens.refreshTokenTtl,
    );

    if (result === 'reused') {
      throw new RefreshTokenReuseError();
    }

    if (result === 'not_found') {
      throw new InvalidTokenError();
    }

    const user = await this.findUser(claims.userId);

    if (!user) {
      await this.sessions.revoke(claims.sessionId);
      throw new InvalidTokenError();
    }

    // Papel relido do banco: mudanças valem na próxima rotação.
    return this.issuer.issue(
      { sessionId: claims.sessionId, userId: user.id, tokenId: nextTokenId },
      user.role,
    );
  }

  private async findUser(userId: string): Promise<UserView | null> {
    try {
      return await this.getUserProfile.execute(userId);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        return null;
      }

      throw error;
    }
  }
}
