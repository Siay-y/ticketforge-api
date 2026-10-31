import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class InsufficientBatchStockError extends DomainError {
  readonly kind = 'business_rule';
  readonly code = 'INSUFFICIENT_BATCH_STOCK';

  constructor(batchName: string, available: number) {
    super(
      `Estoque insuficiente no lote "${batchName}": restam ${available} ingressos`,
    );
  }
}
