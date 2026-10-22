import { VerifyCredentialsUseCase } from '../../../users/application/use-cases/verify-credentials.use-case.js';
import { User } from '../../../users/domain/entities/user.js';
import { Email } from '../../../users/domain/value-objects/email.js';
import { UserRole } from '../../../users/domain/value-objects/user-role.js';
import { FakePasswordHasher } from '../../../users/testing/fake-password-hasher.js';
import { InMemoryUserRepository } from '../../../users/testing/in-memory-user.repository.js';
import { FakeTokenService } from '../../testing/fake-token.service.js';
import { InMemorySessionStore } from '../../testing/in-memory-session.store.js';
import { InvalidCredentialsError } from '../errors/invalid-credentials.error.js';
import { SessionTokenIssuer } from '../services/session-token-issuer.js';
import { LoginUseCase } from './login.use-case.js';

describe('LoginUseCase', () => {
  const tokens = new FakeTokenService();
  let sessions: InMemorySessionStore;
  let login: LoginUseCase;
  let user: User;

  beforeEach(async () => {
    const users = new InMemoryUserRepository();
    const hasher = new FakePasswordHasher();
    sessions = new InMemorySessionStore();
    login = new LoginUseCase(
      new VerifyCredentialsUseCase(users, hasher),
      new SessionTokenIssuer(tokens, sessions),
    );
    user = User.register({
      email: Email.create('cliente@ticketforge.dev'),
      passwordHash: await hasher.hash('Ingresso#2026Seguro'),
    });
    await users.create(user);
  });

  it('abre uma sessão e devolve o par de tokens', async () => {
    const result = await login.execute({
      email: 'cliente@ticketforge.dev',
      password: 'Ingresso#2026Seguro',
    });

    const claims = await tokens.verifyAccessToken(result.accessToken);

    expect(result).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    expect(claims).toMatchObject({ userId: user.id, role: UserRole.CUSTOMER });
    expect(sessions.sessions.get(claims.sessionId)?.userId).toBe(user.id);
  });

  it('cada login abre uma sessão independente', async () => {
    const credentials = {
      email: 'cliente@ticketforge.dev',
      password: 'Ingresso#2026Seguro',
    };

    await login.execute(credentials);
    await login.execute(credentials);

    expect(sessions.sessions.size).toBe(2);
  });

  it('recusa credenciais inválidas sem abrir sessão', async () => {
    await expect(
      login.execute({ email: 'cliente@ticketforge.dev', password: 'errada' }),
    ).rejects.toThrow(InvalidCredentialsError);
    expect(sessions.sessions.size).toBe(0);
  });
});
