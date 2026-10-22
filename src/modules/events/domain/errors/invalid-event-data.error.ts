import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class InvalidEventDataError extends DomainError {
  readonly kind = 'validation';
  readonly code = 'INVALID_EVENT_DATA';

  constructor(message: string) {
    super(message);
  }
}
