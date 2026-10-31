import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class OrderAccessDeniedError extends DomainError {
  readonly kind = 'forbidden';
  readonly code = 'ORDER_ACCESS_DENIED';

  constructor() {
    super('Você não tem permissão para acessar este pedido');
  }
}
