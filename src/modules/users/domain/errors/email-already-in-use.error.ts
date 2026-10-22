import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class EmailAlreadyInUseError extends DomainError {
  readonly kind = 'conflict';
  readonly code = 'EMAIL_ALREADY_IN_USE';

  constructor() {
    super('E-mail já cadastrado');
  }
}
