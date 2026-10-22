import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class TicketBatchNotFoundError extends DomainError {
  readonly kind = 'not_found';
  readonly code = 'TICKET_BATCH_NOT_FOUND';

  constructor() {
    super('Lote não encontrado neste evento');
  }
}
