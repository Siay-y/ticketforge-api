import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';
import {
  type JwtEnv,
  jwtEnvSchema,
} from '../../../../core/config/env.schema.js';
import { EnvService } from '../../../../core/config/env.service.js';
import { UserRole } from '../../../users/domain/value-objects/user-role.js';
import type { AuthenticatedUser } from '../../application/dtos/authenticated-user.js';
import { InvalidTokenError } from '../../application/errors/invalid-token.error.js';
import type {
  RefreshTokenClaims,
  TokenService,
} from '../../application/ports/token-service.js';

const ISSUER = 'ticket-forge';
// Audiências distintas: um tipo de token nunca vale pelo outro.
const ACCESS_AUDIENCE = 'ticket-forge:access';
const REFRESH_AUDIENCE = 'ticket-forge:refresh';
const ALGORITHM = 'HS256';

const accessPayloadSchema = z.object({
  sub: z.uuid(),
  sid: z.uuid(),
  role: z.enum(UserRole),
});

const refreshPayloadSchema = z.object({
  sub: z.uuid(),
  sid: z.uuid(),
  jti: z.uuid(),
});

@Injectable()
export class JwtTokenService implements TokenService {
  readonly accessTokenTtl: number;
  readonly refreshTokenTtl: number;
  private readonly config: JwtEnv;

  constructor(
    private readonly jwt: JwtService,
    env: EnvService,
  ) {
    this.config = env.pick(jwtEnvSchema);
    this.accessTokenTtl = this.config.JWT_ACCESS_EXPIRES_IN;
    this.refreshTokenTtl = this.config.JWT_REFRESH_EXPIRES_IN;
  }

  signAccessToken(claims: AuthenticatedUser): Promise<string> {
    return this.jwt.signAsync(
      { sid: claims.sessionId, role: claims.role },
      {
        secret: this.config.JWT_ACCESS_SECRET,
        expiresIn: this.accessTokenTtl,
        subject: claims.userId,
        audience: ACCESS_AUDIENCE,
        issuer: ISSUER,
        algorithm: ALGORITHM,
      },
    );
  }

  signRefreshToken(claims: RefreshTokenClaims): Promise<string> {
    return this.jwt.signAsync(
      { sid: claims.sessionId },
      {
        secret: this.config.JWT_REFRESH_SECRET,
        expiresIn: this.refreshTokenTtl,
        subject: claims.userId,
        jwtid: claims.tokenId,
        audience: REFRESH_AUDIENCE,
        issuer: ISSUER,
        algorithm: ALGORITHM,
      },
    );
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    const payload = await this.verify(
      token,
      this.config.JWT_ACCESS_SECRET,
      ACCESS_AUDIENCE,
      accessPayloadSchema,
    );

    return { userId: payload.sub, sessionId: payload.sid, role: payload.role };
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
    const payload = await this.verify(
      token,
      this.config.JWT_REFRESH_SECRET,
      REFRESH_AUDIENCE,
      refreshPayloadSchema,
    );

    return {
      userId: payload.sub,
      sessionId: payload.sid,
      tokenId: payload.jti,
    };
  }

  private async verify<S extends z.ZodType>(
    token: string,
    secret: string,
    audience: string,
    schema: S,
  ): Promise<z.output<S>> {
    let payload: unknown;

    try {
      // Algoritmo fixo: barra `alg: none` e troca de algoritmo.
      payload = await this.jwt.verifyAsync(token, {
        secret,
        audience,
        issuer: ISSUER,
        algorithms: [ALGORITHM],
      });
    } catch {
      throw new InvalidTokenError();
    }

    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      throw new InvalidTokenError();
    }

    return parsed.data;
  }
}
