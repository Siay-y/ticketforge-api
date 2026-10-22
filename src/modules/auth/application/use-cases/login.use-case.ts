import { Injectable } from '@nestjs/common';
import { VerifyCredentialsUseCase } from '../../../users/application/use-cases/verify-credentials.use-case.js';
import type { AuthTokens } from '../dtos/auth-tokens.js';
import { InvalidCredentialsError } from '../errors/invalid-credentials.error.js';
import { SessionTokenIssuer } from '../services/session-token-issuer.js';

export interface LoginInput {
  email: string;
  password: string;
}

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly verifyCredentials: VerifyCredentialsUseCase,
    private readonly issuer: SessionTokenIssuer,
  ) {}

  async execute(input: LoginInput): Promise<AuthTokens> {
    const user = await this.verifyCredentials.execute(input);

    if (!user) {
      throw new InvalidCredentialsError();
    }

    return this.issuer.startSession(user);
  }
}
