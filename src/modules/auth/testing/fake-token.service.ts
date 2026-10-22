import type { AuthenticatedUser } from '../application/dtos/authenticated-user.js';
import { InvalidTokenError } from '../application/errors/invalid-token.error.js';
import type {
  RefreshTokenClaims,
  TokenService,
} from '../application/ports/token-service.js';

/** Tokens legíveis (`tipo.json`), sem assinatura, só para testes de caso de uso. */
export class FakeTokenService implements TokenService {
  readonly accessTokenTtl = 900;
  readonly refreshTokenTtl = 604_800;

  signAccessToken(claims: AuthenticatedUser): Promise<string> {
    return Promise.resolve(`access.${JSON.stringify(claims)}`);
  }

  signRefreshToken(claims: RefreshTokenClaims): Promise<string> {
    return Promise.resolve(`refresh.${JSON.stringify(claims)}`);
  }

  verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    return this.decode(token, 'access.');
  }

  verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
    return this.decode(token, 'refresh.');
  }

  private decode<T>(token: string, prefix: string): Promise<T> {
    if (!token.startsWith(prefix)) {
      return Promise.reject(new InvalidTokenError());
    }

    return Promise.resolve(JSON.parse(token.slice(prefix.length)) as T);
  }
}
