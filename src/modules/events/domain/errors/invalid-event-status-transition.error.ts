import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class InvalidEventStatusTransitionError extends DomainError {
  readonly kind = 'business_rule';
  readonly code = 'INVALID_STATUS_TRANSITION';

  constructor(message: string) {
    super(message);
  }
}
