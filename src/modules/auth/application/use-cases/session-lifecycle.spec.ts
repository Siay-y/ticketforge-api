import { UserRole } from '../../../users/domain/value-objects/user-role.js';
import { FakeTokenService } from '../../testing/fake-token.service.js';
import { InMemorySessionStore } from '../../testing/in-memory-session.store.js';
import { InvalidTokenError } from '../errors/invalid-token.error.js';
import { SessionTokenIssuer } from '../services/session-token-issuer.js';
import { LogoutUseCase } from './logout.use-case.js';
import { ValidateAccessTokenUseCase } from './validate-access-token.use-case.js';

describe('Ciclo de vida da sessão (validação e logout)', () => {
  const tokens = new FakeTokenService();
  let sessions: InMemorySessionStore;
  let validate: ValidateAccessTokenUseCase;
  let logout: LogoutUseCase;
  let accessToken: string;

  beforeEach(async () => {
    sessions = new InMemorySessionStore();
    validate = new ValidateAccessTokenUseCase(tokens, sessions);
    logout = new LogoutUseCase(sessions);
    ({ accessToken } = await new SessionTokenIssuer(
      tokens,
      sessions,
    ).startSession({ id: crypto.randomUUID(), role: UserRole.CUSTOMER }));
  });

  it('aceita access token de sessão ativa', async () => {
    await expect(validate.execute(accessToken)).resolves.toMatchObject({
      role: UserRole.CUSTOMER,
    });
  });

  it('recusa o mesmo access token logo após o logout', async () => {
    await logout.execute(await validate.execute(accessToken));

    await expect(validate.execute(accessToken)).rejects.toThrow(
      InvalidTokenError,
    );
  });

  it('logout é idempotente', async () => {
    const user = await validate.execute(accessToken);

    await logout.execute(user);

    await expect(logout.execute(user)).resolves.toBeUndefined();
  });
});
