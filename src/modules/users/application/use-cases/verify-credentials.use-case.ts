import { Injectable } from '@nestjs/common';
import type { User } from '../../domain/entities/user.js';
import { InvalidEmailError } from '../../domain/errors/invalid-email.error.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { Email } from '../../domain/value-objects/email.js';
import { type UserView, toUserView } from '../dtos/user.view.js';
import { PasswordHasher } from '../ports/password-hasher.js';

export interface VerifyCredentialsInput {
  email: string;
  password: string;
}

@Injectable()
export class VerifyCredentialsUseCase {
  private decoyHash?: Promise<string>;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  /** Devolve `null` para qualquer falha, sem distinguir e-mail inexistente de senha errada. */
  async execute(input: VerifyCredentialsInput): Promise<UserView | null> {
    const user = await this.findUser(input.email);

    // Sem usuário, verifica contra um hash descartável: o tempo de resposta
    // não pode revelar quais e-mails estão cadastrados.
    const passwordHash = user?.passwordHash ?? (await this.getDecoyHash());
    const isValid = await this.hasher.verify(input.password, passwordHash);

    if (!user || !isValid) {
      return null;
    }

    if (this.hasher.needsRehash(user.passwordHash)) {
      user.changePasswordHash(await this.hasher.hash(input.password));
      await this.users.update(user);
    }

    return toUserView(user);
  }

  private async findUser(rawEmail: string): Promise<User | null> {
    try {
      return await this.users.findByEmail(Email.create(rawEmail));
    } catch (error) {
      if (error instanceof InvalidEmailError) {
        return null;
      }

      throw error;
    }
  }

  private getDecoyHash(): Promise<string> {
    this.decoyHash ??= this.hasher.hash(crypto.randomUUID());

    return this.decoyHash;
  }
}
