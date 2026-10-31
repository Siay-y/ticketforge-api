import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class CouponCodeAlreadyExistsError extends DomainError {
  readonly kind = 'conflict';
  readonly code = 'COUPON_CODE_ALREADY_EXISTS';

  constructor() {
    super('Já existe um cupom com este código neste evento');
  }
}
