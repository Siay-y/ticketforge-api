import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class UserNotFoundError extends DomainError {
  readonly kind = 'not_found';
  readonly code = 'USER_NOT_FOUND';

  constructor() {
    super('Usuário não encontrado');
  }
}
