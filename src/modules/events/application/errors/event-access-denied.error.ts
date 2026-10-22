import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

/** O ator não é dono do evento nem administrador. */
export class EventAccessDeniedError extends DomainError {
  readonly kind = 'forbidden';
  readonly code = 'EVENT_ACCESS_DENIED';

  constructor() {
    super('Você não tem permissão para gerenciar este evento');
  }
}
