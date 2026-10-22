import { GetUserProfileUseCase } from '../../../users/application/use-cases/get-user-profile.use-case.js';
import { User } from '../../../users/domain/entities/user.js';
import { Email } from '../../../users/domain/value-objects/email.js';
import { UserRole } from '../../../users/domain/value-objects/user-role.js';
import { InMemoryUserRepository } from '../../../users/testing/in-memory-user.repository.js';
import { FakeTokenService } from '../../testing/fake-token.service.js';
import { InMemorySessionStore } from '../../testing/in-memory-session.store.js';
import type { AuthTokens } from '../dtos/auth-tokens.js';
import { InvalidTokenError } from '../errors/invalid-token.error.js';
import { RefreshTokenReuseError } from '../errors/refresh-token-reuse.error.js';
import { SessionTokenIssuer } from '../services/session-token-issuer.js';
import { RefreshTokenUseCase } from './refresh-token.use-case.js';

describe('RefreshTokenUseCase', () => {
  const tokens = new FakeTokenService();
  let users: InMemoryUserRepository;
  let sessions: InMemorySessionStore;
  let refresh: RefreshTokenUseCase;
  let user: User;
  let initial: AuthTokens;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    sessions = new InMemorySessionStore();
    const issuer = new SessionTokenIssuer(tokens, sessions);
    refresh = new RefreshTokenUseCase(
      tokens,
      sessions,
      issuer,
      new GetUserProfileUseCase(users),
    );
    user = User.register({
      email: Email.create('cliente@ticketforge.dev'),
      passwordHash: 'hash',
    });
    await users.create(user);
    initial = await issuer.startSession(user);
  });

  const sessionIdOf = async (pair: AuthTokens) =>
    (await tokens.verifyRefreshToken(pair.refreshToken)).sessionId;

  it('emite um novo par na mesma sessão, com novo jti', async () => {
    const rotated = await refresh.execute(initial.refreshToken);

    const before = await tokens.verifyRefreshToken(initial.refreshToken);
    const after = await tokens.verifyRefreshToken(rotated.refreshToken);

    expect(after.sessionId).toBe(before.sessionId);
    expect(after.tokenId).not.toBe(before.tokenId);
    expect(sessions.sessions.get(after.sessionId)?.tokenId).toBe(after.tokenId);
  });

  it('o refresh token anterior deixa de valer após a rotação', async () => {
    await refresh.execute(initial.refreshToken);

    await expect(refresh.execute(initial.refreshToken)).rejects.toThrow(
      RefreshTokenReuseError,
    );
  });

  it('reuso revoga a sessão inteira, inclusive o token legítimo mais novo', async () => {
    const rotated = await refresh.execute(initial.refreshToken);

    await expect(refresh.execute(initial.refreshToken)).rejects.toThrow(
      RefreshTokenReuseError,
    );
    expect(await sessions.isActive(await sessionIdOf(rotated))).toBe(false);
    await expect(refresh.execute(rotated.refreshToken)).rejects.toThrow(
      InvalidTokenError,
    );
  });

  it('recusa refresh de sessão encerrada no logout', async () => {
    await sessions.revoke(await sessionIdOf(initial));

    await expect(refresh.execute(initial.refreshToken)).rejects.toThrow(
      InvalidTokenError,
    );
  });

  it('recusa access token no lugar do refresh token', async () => {
    await expect(refresh.execute(initial.accessToken)).rejects.toThrow(
      InvalidTokenError,
    );
  });

  it('aplica o papel atual do banco no novo access token', async () => {
    users.users.set(
      user.id,
      User.restore({
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        role: UserRole.ORGANIZER,
        createdAt: user.createdAt,
        updatedAt: new Date(),
      }),
    );

    const rotated = await refresh.execute(initial.refreshToken);

    expect((await tokens.verifyAccessToken(rotated.accessToken)).role).toBe(
      UserRole.ORGANIZER,
    );
  });

  it('encerra a sessão se o usuário não existir mais', async () => {
    users.users.delete(user.id);

    await expect(refresh.execute(initial.refreshToken)).rejects.toThrow(
      InvalidTokenError,
    );
    expect(sessions.sessions.size).toBe(0);
  });
});
