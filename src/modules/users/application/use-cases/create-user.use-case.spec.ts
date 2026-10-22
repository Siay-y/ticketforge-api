import { EmailAlreadyInUseError } from '../../domain/errors/email-already-in-use.error.js';
import { InvalidEmailError } from '../../domain/errors/invalid-email.error.js';
import { UserRole } from '../../domain/value-objects/user-role.js';
import { FakePasswordHasher } from '../../testing/fake-password-hasher.js';
import { InMemoryUserRepository } from '../../testing/in-memory-user.repository.js';
import { CreateUserUseCase } from './create-user.use-case.js';

describe('CreateUserUseCase', () => {
  let users: InMemoryUserRepository;
  let createUser: CreateUserUseCase;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    createUser = new CreateUserUseCase(users, new FakePasswordHasher());
  });

  it('persiste o usuário com e-mail normalizado e senha em hash', async () => {
    const view = await createUser.execute({
      email: 'Novo@TicketForge.dev',
      password: 'Ingresso#2026Seguro',
    });

    const stored = users.users.get(view.id);

    expect(view).toMatchObject({
      email: 'novo@ticketforge.dev',
      role: UserRole.CUSTOMER,
    });
    expect(stored?.passwordHash).toBe('hashed:Ingresso#2026Seguro');
  });

  it('não expõe o hash da senha no retorno', async () => {
    const view = await createUser.execute({
      email: 'a@ticketforge.dev',
      password: 'Ingresso#2026Seguro',
    });

    expect(view).not.toHaveProperty('passwordHash');
  });

  it('recusa e-mail já cadastrado, mesmo com caixa diferente', async () => {
    await createUser.execute({ email: 'a@x.dev', password: 'p' });

    await expect(
      createUser.execute({ email: 'A@X.dev', password: 'p' }),
    ).rejects.toThrow(EmailAlreadyInUseError);
  });

  it('propaga e-mail inválido como erro de domínio', async () => {
    await expect(
      createUser.execute({ email: 'invalido', password: 'p' }),
    ).rejects.toThrow(InvalidEmailError);
  });
});
