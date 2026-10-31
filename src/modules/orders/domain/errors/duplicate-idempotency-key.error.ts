import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

/** Sinal interno do repositório para o caso de uso. */
export class DuplicateIdempotencyKeyError extends DomainError {
  readonly kind = 'conflict';
  readonly code = 'DUPLICATE_IDEMPOTENCY_KEY';

  constructor() {
    super('Já existe um pedido com esta chave de idempotência');
  }
}
