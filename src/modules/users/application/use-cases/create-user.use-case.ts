import { Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/user.js';
import { EmailAlreadyInUseError } from '../../domain/errors/email-already-in-use.error.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { Email } from '../../domain/value-objects/email.js';
import { type UserView, toUserView } from '../dtos/user.view.js';
import { PasswordHasher } from '../ports/password-hasher.js';

export interface CreateUserInput {
  email: string;
  password: string;
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: CreateUserInput): Promise<UserView> {
    const email = Email.create(input.email);

    // Atalho para não gastar um hash em duplicata óbvia. A garantia real é o índice único.
    if (await this.users.findByEmail(email)) {
      throw new EmailAlreadyInUseError();
    }

    const user = User.register({
      email,
      passwordHash: await this.hasher.hash(input.password),
    });

    await this.users.create(user);

    return toUserView(user);
  }
}
