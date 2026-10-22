import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class EventNotEditableError extends DomainError {
  readonly kind = 'business_rule';
  readonly code = 'EVENT_NOT_EDITABLE';

  constructor(status: string) {
    super(`Eventos com status "${status}" não podem ser alterados`);
  }
}
