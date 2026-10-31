import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class OrderTicketLimitExceededError extends DomainError {
  readonly kind = 'business_rule';
  readonly code = 'ORDER_TICKET_LIMIT_EXCEEDED';

  constructor(limit: number) {
    super(`Um pedido pode ter no máximo ${limit} ingressos`);
  }
}
