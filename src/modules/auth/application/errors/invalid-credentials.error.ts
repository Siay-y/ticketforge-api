import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class InvalidCredentialsError extends DomainError {
  readonly kind = 'unauthorized';
  readonly code = 'INVALID_CREDENTIALS';

  constructor() {
    super('E-mail ou senha inválidos');
  }
}
