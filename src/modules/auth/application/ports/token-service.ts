import type { AuthenticatedUser } from '../dtos/authenticated-user.js';

export interface RefreshTokenClaims {
  userId: string;
  sessionId: string;
  /** Identificador único deste refresh token (jti), trocado a cada rotação. */
  tokenId: string;
}

export abstract class TokenService {
  /** Validade do access token, em segundos. */
  abstract readonly accessTokenTtl: number;

  /** Validade do refresh token, em segundos; também é o TTL da sessão. */
  abstract readonly refreshTokenTtl: number;

  abstract signAccessToken(claims: AuthenticatedUser): Promise<string>;

  abstract signRefreshToken(claims: RefreshTokenClaims): Promise<string>;

  /** Lança `InvalidTokenError` para qualquer token que não seja um access token válido. */
  abstract verifyAccessToken(token: string): Promise<AuthenticatedUser>;

  /** Lança `InvalidTokenError` para qualquer token que não seja um refresh token válido. */
  abstract verifyRefreshToken(token: string): Promise<RefreshTokenClaims>;
}
