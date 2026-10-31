import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { DiscountType } from '../../../../domain/value-objects/discount-type.js';
import { EventOrmEntity } from './event.orm-entity.js';

export const COUPONS_EVENT_CODE_UNIQUE_INDEX = 'UQ_coupons_event_code';

@Entity({ name: 'coupons' })
@Index(COUPONS_EVENT_CODE_UNIQUE_INDEX, ['eventId', 'code'], { unique: true })
@Check('CHK_coupons_code_uppercase', '"code" = upper("code")')
@Check('CHK_coupons_discount_value_positive', '"discount_value" > 0')
@Check(
  'CHK_coupons_percentage_max',
  `"discount_type" <> 'percentage' OR "discount_value" <= 10000`,
)
@Check('CHK_coupons_max_uses_positive', '"max_uses" IS NULL OR "max_uses" > 0')
@Check(
  'CHK_coupons_used_count_range',
  '"used_count" >= 0 AND ("max_uses" IS NULL OR "used_count" <= "max_uses")',
)
export class CouponOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_coupons' })
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @ManyToOne(() => EventOrmEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'event_id',
    foreignKeyConstraintName: 'FK_coupons_event',
  })
  event?: EventOrmEntity;

  @Column({ type: 'varchar', length: 32 })
  code: string;

  @Column({
    name: 'discount_type',
    type: 'enum',
    enum: DiscountType,
    enumName: 'coupon_discount_type',
  })
  discountType: DiscountType;

  @Column({ name: 'discount_value', type: 'integer' })
  discountValue: number;

  @Column({ name: 'max_uses', type: 'integer', nullable: true })
  maxUses: number | null;

  @Column({ name: 'used_count', type: 'integer', default: 0 })
  usedCount: number;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
