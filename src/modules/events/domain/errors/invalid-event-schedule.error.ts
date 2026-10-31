import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class InvalidEventScheduleError extends DomainError {
  readonly kind = 'business_rule';
  readonly code = 'INVALID_EVENT_SCHEDULE';

  constructor(message: string) {
    super(message);
  }
}
