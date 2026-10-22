import { JwtService } from '@nestjs/jwt';
import type { JwtEnv } from '../../../../core/config/env.schema.js';
import type { EnvService } from '../../../../core/config/env.service.js';
import { UserRole } from '../../../users/domain/value-objects/user-role.js';
import { InvalidTokenError } from '../../application/errors/invalid-token.error.js';
import { JwtTokenService } from './jwt-token.service.js';

const config: JwtEnv = {
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_ACCESS_EXPIRES_IN: 900,
  JWT_REFRESH_SECRET: 'r'.repeat(32),
  JWT_REFRESH_EXPIRES_IN: 604_800,
};

const env = { pick: () => config } as unknown as EnvService;

const user = {
  userId: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  role: UserRole.ORGANIZER,
};

describe('JwtTokenService', () => {
  const jwt = new JwtService();
  const service = new JwtTokenService(jwt, env);

  it('assina e verifica o access token preservando as claims', async () => {
    const token = await service.signAccessToken(user);

    await expect(service.verifyAccessToken(token)).resolves.toEqual(user);
  });

  it('assina e verifica o refresh token com jti', async () => {
    const claims = {
      userId: user.userId,
      sessionId: user.sessionId,
      tokenId: crypto.randomUUID(),
    };
    const token = await service.signRefreshToken(claims);

    await expect(service.verifyRefreshToken(token)).resolves.toEqual(claims);
  });

  it('alinha a expiração do token ao TTL configurado', async () => {
    const token = await service.signAccessToken(user);
    const { iat, exp } = jwt.decode<{ iat: number; exp: number }>(token);

    expect(exp - iat).toBe(900);
  });

  it('não aceita refresh token como access token, nem o contrário', async () => {
    const access = await service.signAccessToken(user);
    const refresh = await service.signRefreshToken({
      userId: user.userId,
      sessionId: user.sessionId,
      tokenId: crypto.randomUUID(),
    });

    await expect(service.verifyAccessToken(refresh)).rejects.toThrow(
      InvalidTokenError,
    );
    await expect(service.verifyRefreshToken(access)).rejects.toThrow(
      InvalidTokenError,
    );
  });

  it('recusa token com assinatura adulterada', async () => {
    const token = await service.signAccessToken(user);
    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: user.userId, sid: user.sessionId, role: 'admin' }),
    ).toString('base64url');

    await expect(
      service.verifyAccessToken(`${header}.${forgedPayload}.${signature}`),
    ).rejects.toThrow(InvalidTokenError);
  });

  it('recusa token com alg "none"', async () => {
    const encode = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      sub: user.userId,
      sid: user.sessionId,
      role: 'admin',
      aud: 'ticket-forge:access',
      iss: 'ticket-forge',
    })}.`;

    await expect(service.verifyAccessToken(unsigned)).rejects.toThrow(
      InvalidTokenError,
    );
  });

  it('recusa token válido com papel fora do enum', async () => {
    const token = await jwt.signAsync(
      { sid: user.sessionId, role: 'superuser' },
      {
        secret: config.JWT_ACCESS_SECRET,
        subject: user.userId,
        audience: 'ticket-forge:access',
        issuer: 'ticket-forge',
        expiresIn: 60,
      },
    );

    await expect(service.verifyAccessToken(token)).rejects.toThrow(
      InvalidTokenError,
    );
  });
});
