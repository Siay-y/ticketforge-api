import type { Coupon } from '../../domain/entities/coupon.js';
import type { DiscountType } from '../../domain/value-objects/discount-type.js';

export interface CouponView {
  id: string;
  eventId: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
}

export const toCouponView = (coupon: Coupon): CouponView => ({
  id: coupon.id,
  eventId: coupon.eventId,
  code: coupon.code,
  discountType: coupon.discountType,
  discountValue: coupon.discountValue,
  maxUses: coupon.maxUses,
  usedCount: coupon.usedCount,
  expiresAt: coupon.expiresAt,
  isActive: coupon.isActive,
  createdAt: coupon.createdAt,
});
