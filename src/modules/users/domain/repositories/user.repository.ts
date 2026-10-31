import type { User } from '../entities/user.js';
import type { Email } from '../value-objects/email.js';

export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;

  abstract findByEmail(email: Email): Promise<User | null>;

  /** Lança `EmailAlreadyInUseError` se o e-mail já existir. */
  abstract create(user: User): Promise<void>;

  abstract update(user: User): Promise<void>;
}
