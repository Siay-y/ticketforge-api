import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class BatchEventMismatchError extends DomainError {
  readonly kind = 'business_rule';
  readonly code = 'BATCH_EVENT_MISMATCH';

  constructor() {
    super('Todos os lotes do pedido devem pertencer ao evento informado');
  }
}
