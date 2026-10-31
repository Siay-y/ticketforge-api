import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class OrderNotFoundError extends DomainError {
  readonly kind = 'not_found';
  readonly code = 'ORDER_NOT_FOUND';

  constructor() {
    super('Pedido não encontrado');
  }
}
