import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class InvalidEmailError extends DomainError {
  readonly kind = 'validation';
  readonly code = 'INVALID_EMAIL';

  constructor() {
    super('E-mail inválido');
  }
}
