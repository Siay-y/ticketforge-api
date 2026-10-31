import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class InvalidOrderStatusError extends DomainError {
  readonly kind = 'business_rule';
  readonly code = 'INVALID_ORDER_STATUS';

  constructor(message: string) {
    super(message);
  }
}
