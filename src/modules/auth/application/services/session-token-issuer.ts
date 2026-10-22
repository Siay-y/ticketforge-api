import { Injectable } from '@nestjs/common';
import type { UserRole } from '../../../users/domain/value-objects/user-role.js';
import type { AuthTokens } from '../dtos/auth-tokens.js';
import { type Session, SessionStore } from '../ports/session-store.js';
import { TokenService } from '../ports/token-service.js';

export interface SessionOwner {
  id: string;
  role: UserRole;
}

@Injectable()
export class SessionTokenIssuer {
  constructor(
    private readonly tokens: TokenService,
    private readonly sessions: SessionStore,
  ) {}

  /** Abre uma sessão nova, usada no login e no cadastro. */
  async startSession(owner: SessionOwner): Promise<AuthTokens> {
    const session: Session = {
      sessionId: crypto.randomUUID(),
      userId: owner.id,
      tokenId: crypto.randomUUID(),
    };

    await this.sessions.create(session, this.tokens.refreshTokenTtl);

    return this.issue(session, owner.role);
  }

  /** Assina o par de tokens de uma sessão já registrada no store. */
  async issue(session: Session, role: UserRole): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccessToken({
        userId: session.userId,
        sessionId: session.sessionId,
        role,
      }),
      this.tokens.signRefreshToken(session),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.tokens.accessTokenTtl,
    };
  }
}
