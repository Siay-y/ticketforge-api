import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class EventAccessDeniedError extends DomainError {
  readonly kind = 'forbidden';
  readonly code = 'EVENT_ACCESS_DENIED';

  constructor() {
    super('Você não tem permissão para gerenciar este evento');
  }
}
