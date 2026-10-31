import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export type CouponRejection =
  'not_found' | 'inactive' | 'expired' | 'exhausted';

const MESSAGES: Record<CouponRejection, string> = {
  not_found: 'Cupom inexistente para este evento',
  inactive: 'Cupom desativado',
  expired: 'Cupom expirado',
  exhausted: 'Cupom esgotado',
};

export class CouponNotRedeemableError extends DomainError {
  readonly kind = 'business_rule';
  readonly code: string;

  constructor(readonly reason: CouponRejection) {
    super(MESSAGES[reason]);
    this.code = `COUPON_${reason.toUpperCase()}`;
  }
}
