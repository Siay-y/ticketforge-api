import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class TicketBatchQuantityBelowSoldError extends DomainError {
  readonly kind = 'business_rule';
  readonly code = 'TICKET_BATCH_QUANTITY_BELOW_SOLD';

  constructor(soldQuantity: number) {
    super(
      `O lote já vendeu ${soldQuantity} ingressos; a quantidade total não pode ficar abaixo disso`,
    );
  }
}
