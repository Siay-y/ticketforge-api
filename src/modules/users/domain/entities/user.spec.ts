import { Email } from '../value-objects/email.js';
import { UserRole } from '../value-objects/user-role.js';
import { User } from './user.js';

const email = Email.create('cliente@ticketforge.dev');

describe('User', () => {
  it('nasce como CUSTOMER, com id UUID e timestamps iguais', () => {
    const now = new Date('2026-10-21T12:00:00Z');
    const user = User.register({ email, passwordHash: 'hash' }, now);

    expect(user.role).toBe(UserRole.CUSTOMER);
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.createdAt).toEqual(now);
    expect(user.updatedAt).toEqual(now);
  });

  it('gera ids distintos a cada cadastro', () => {
    const first = User.register({ email, passwordHash: 'hash' });
    const second = User.register({ email, passwordHash: 'hash' });

    expect(first.id).not.toBe(second.id);
  });

  it('restaura o papel persistido sem aplicar a regra de cadastro', () => {
    const user = User.restore({
      id: crypto.randomUUID(),
      email,
      passwordHash: 'hash',
      role: UserRole.ADMIN,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(user.role).toBe(UserRole.ADMIN);
  });

  it('troca o hash da senha e atualiza updatedAt', () => {
    const user = User.register(
      { email, passwordHash: 'antigo' },
      new Date('2026-01-01T00:00:00Z'),
    );
    const later = new Date('2026-06-01T00:00:00Z');

    user.changePasswordHash('novo', later);

    expect(user.passwordHash).toBe('novo');
    expect(user.updatedAt).toEqual(later);
  });

  it('não aceita hash de senha vazio', () => {
    expect(() => User.register({ email, passwordHash: '  ' })).toThrow();
  });
});
