import { User } from '../../domain/entities/user.js';
import { Email } from '../../domain/value-objects/email.js';
import { FakePasswordHasher } from '../../testing/fake-password-hasher.js';
import { InMemoryUserRepository } from '../../testing/in-memory-user.repository.js';
import { VerifyCredentialsUseCase } from './verify-credentials.use-case.js';

const EMAIL = 'cliente@ticketforge.dev';
const PASSWORD = 'Ingresso#2026Seguro';

describe('VerifyCredentialsUseCase', () => {
  let users: InMemoryUserRepository;
  let hasher: FakePasswordHasher;
  let verifyCredentials: VerifyCredentialsUseCase;
  let user: User;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    hasher = new FakePasswordHasher();
    verifyCredentials = new VerifyCredentialsUseCase(users, hasher);
    user = User.register({
      email: Email.create(EMAIL),
      passwordHash: await hasher.hash(PASSWORD),
    });
    await users.create(user);
  });

  it('devolve o usuário para credenciais corretas', async () => {
    await expect(
      verifyCredentials.execute({ email: EMAIL, password: PASSWORD }),
    ).resolves.toMatchObject({ id: user.id, email: EMAIL });
  });

  it('devolve null para senha errada', async () => {
    await expect(
      verifyCredentials.execute({ email: EMAIL, password: 'errada' }),
    ).resolves.toBeNull();
  });

  it('para e-mail inexistente, ainda executa uma verificação de hash', async () => {
    const result = await verifyCredentials.execute({
      email: 'ninguem@ticketforge.dev',
      password: PASSWORD,
    });

    expect(result).toBeNull();
    expect(hasher.verifiedAgainst).toHaveLength(1);
  });

  it('para e-mail malformado, responde igual a inexistente', async () => {
    const result = await verifyCredentials.execute({
      email: 'malformado',
      password: PASSWORD,
    });

    expect(result).toBeNull();
    expect(hasher.verifiedAgainst).toHaveLength(1);
  });

  it('refaz o hash quando os parâmetros armazenados estão desatualizados', async () => {
    const outdated = 'legado:hash';
    hasher.outdatedHashes.add(outdated);
    hasher.verify = (plain, hash) =>
      Promise.resolve(hash === outdated && plain === PASSWORD);
    user.changePasswordHash(outdated);

    await verifyCredentials.execute({ email: EMAIL, password: PASSWORD });

    expect(users.users.get(user.id)?.passwordHash).toBe(`hashed:${PASSWORD}`);
  });
});
