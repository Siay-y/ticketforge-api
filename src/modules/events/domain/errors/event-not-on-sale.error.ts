import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class EventNotOnSaleError extends DomainError {
  readonly kind = 'business_rule';
  readonly code = 'EVENT_NOT_ON_SALE';

  constructor() {
    super('Este evento não está à venda');
  }
}
