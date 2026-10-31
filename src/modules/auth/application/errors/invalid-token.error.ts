import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class InvalidTokenError extends DomainError {
  readonly kind = 'unauthorized';
  readonly code = 'INVALID_TOKEN';

  constructor() {
    super('Token inválido, expirado ou revogado');
  }
}
