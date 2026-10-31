import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class EventCapacityExceededError extends DomainError {
  readonly kind = 'business_rule';
  readonly code = 'EVENT_CAPACITY_EXCEEDED';

  constructor(allocated: number, maxCapacity: number) {
    super(
      `Os lotes somariam ${allocated} ingressos, acima da capacidade máxima de ${maxCapacity}`,
    );
  }
}
