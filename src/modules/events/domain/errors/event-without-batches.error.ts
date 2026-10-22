import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class EventWithoutBatchesError extends DomainError {
  readonly kind = 'business_rule';
  readonly code = 'EVENT_WITHOUT_BATCHES';

  constructor() {
    super('O evento precisa de ao menos um lote para ser publicado');
  }
}
