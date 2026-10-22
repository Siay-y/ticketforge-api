import { Injectable } from '@nestjs/common';
import { CreateUserUseCase } from '../../../users/application/use-cases/create-user.use-case.js';
import type { AuthTokens } from '../dtos/auth-tokens.js';
import { SessionTokenIssuer } from '../services/session-token-issuer.js';

export interface RegisterUserInput {
  email: string;
  password: string;
}

@Injectable()
export class RegisterUserUseCase {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly issuer: SessionTokenIssuer,
  ) {}

  async execute(input: RegisterUserInput): Promise<AuthTokens> {
    const user = await this.createUser.execute(input);

    return this.issuer.startSession(user);
  }
}
