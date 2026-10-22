import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

/** Token ausente, malformado, expirado, com assinatura inválida ou de sessão encerrada. */
export class InvalidTokenError extends DomainError {
  readonly kind = 'unauthorized';
  readonly code = 'INVALID_TOKEN';

  constructor() {
    super('Token inválido, expirado ou revogado');
  }
}
