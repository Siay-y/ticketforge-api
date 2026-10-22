import type { User } from '../domain/entities/user.js';
import { EmailAlreadyInUseError } from '../domain/errors/email-already-in-use.error.js';
import type { UserRepository } from '../domain/repositories/user.repository.js';
import type { Email } from '../domain/value-objects/email.js';

export class InMemoryUserRepository implements UserRepository {
  readonly users = new Map<string, User>();

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  findByEmail(email: Email): Promise<User | null> {
    const user = [...this.users.values()].find((candidate) =>
      candidate.email.equals(email),
    );

    return Promise.resolve(user ?? null);
  }

  create(user: User): Promise<void> {
    if ([...this.users.values()].some((u) => u.email.equals(user.email))) {
      return Promise.reject(new EmailAlreadyInUseError());
    }

    this.users.set(user.id, user);

    return Promise.resolve();
  }

  update(user: User): Promise<void> {
    this.users.set(user.id, user);

    return Promise.resolve();
  }
}
