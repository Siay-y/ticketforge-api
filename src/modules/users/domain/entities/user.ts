import type { Email } from '../value-objects/email.js';
import { UserRole } from '../value-objects/user-role.js';

export interface UserProps {
  id: string;
  email: Email;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterUserProps {
  email: Email;
  passwordHash: string;
}

export class User {
  private constructor(private props: UserProps) {
    User.assertPasswordHash(props.passwordHash);
  }

  /** Todo cadastro nasce como CUSTOMER; papéis elevados são concedidos por um administrador. */
  static register(input: RegisterUserProps, now: Date = new Date()): User {
    return new User({
      id: crypto.randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash,
      role: UserRole.CUSTOMER,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Reconstrói um usuário já persistido, sem aplicar regras de cadastro. */
  static restore(props: UserProps): User {
    return new User({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get email(): Email {
    return this.props.email;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  changePasswordHash(passwordHash: string, now: Date = new Date()): void {
    User.assertPasswordHash(passwordHash);
    this.props = { ...this.props, passwordHash, updatedAt: now };
  }

  private static assertPasswordHash(passwordHash: string): void {
    if (passwordHash.trim().length === 0) {
      throw new Error('O hash da senha não pode ser vazio');
    }
  }
}
