import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class EventNotFoundError extends DomainError {
  readonly kind = 'not_found';
  readonly code = 'EVENT_NOT_FOUND';

  constructor() {
    super('Evento não encontrado');
  }
}
