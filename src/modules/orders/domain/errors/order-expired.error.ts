import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class OrderExpiredError extends DomainError {
  readonly kind = 'business_rule';
  readonly code = 'ORDER_EXPIRED';

  constructor() {
    super('O prazo para pagar este pedido expirou');
  }
}
