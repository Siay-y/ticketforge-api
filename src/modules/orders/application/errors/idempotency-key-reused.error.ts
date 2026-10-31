import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class IdempotencyKeyReusedError extends DomainError {
  readonly kind = 'conflict';
  readonly code = 'IDEMPOTENCY_KEY_REUSED';

  constructor() {
    super('Esta Idempotency-Key já foi usada com outro conteúdo de pedido');
  }
}
