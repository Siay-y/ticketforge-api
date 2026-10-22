import type { User } from '../entities/user.js';
import type { Email } from '../value-objects/email.js';

/** Porta de persistência. Classe abstrata para servir também de token de injeção. */
export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;

  abstract findByEmail(email: Email): Promise<User | null>;

  /** Lança `EmailAlreadyInUseError` se o e-mail já existir, inclusive em cadastros simultâneos. */
  abstract create(user: User): Promise<void>;

  abstract update(user: User): Promise<void>;
}
