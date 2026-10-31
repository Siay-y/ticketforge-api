import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class TicketBatchSalesClosedError extends DomainError {
  readonly kind = 'business_rule';
  readonly code = 'BATCH_SALES_CLOSED';

  constructor(batchName: string) {
    super(`As vendas do lote "${batchName}" não estão abertas`);
  }
}
