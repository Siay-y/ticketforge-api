import { ApiProperty } from '@nestjs/swagger';
import type { CouponView } from '../../../application/dtos/coupon.view.js';
import { DiscountType } from '../../../domain/value-objects/discount-type.js';

export class CouponResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @ApiProperty({ example: 'VERAO15' })
  code: string;

  @ApiProperty({ enum: DiscountType, enumName: 'DiscountType' })
  discountType: DiscountType;

  @ApiProperty({
    example: 1500,
    description: 'Pontos-base (percentage) ou centavos (fixed_cents).',
  })
  discountValue: number;

  @ApiProperty({ type: Number, nullable: true, example: 100 })
  maxUses: number | null;

  @ApiProperty({ example: 12 })
  usedCount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt: Date;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  static from(view: CouponView): CouponResponse {
    return Object.assign(new CouponResponse(), view);
  }
}
