import type { Coupon } from '../entities/coupon.js';

export abstract class CouponRepository {
  /** Lança `CouponCodeAlreadyExistsError` se o código já existir. */
  abstract create(coupon: Coupon): Promise<void>;

  abstract listByEvent(eventId: string): Promise<Coupon[]>;

  /** `FOR UPDATE`; exige transação ativa. */
  abstract lockByCode(eventId: string, code: string): Promise<Coupon | null>;

  /** `FOR UPDATE`; exige transação ativa. */
  abstract lockById(couponId: string): Promise<Coupon | null>;

  abstract saveUsage(coupon: Coupon): Promise<void>;
}
