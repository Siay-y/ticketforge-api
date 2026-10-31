import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { OrderStatus } from '../../../../domain/value-objects/order-status.js';

export const ORDERS_IDEMPOTENCY_UNIQUE_INDEX =
  'UQ_orders_customer_idempotency_key';

@Entity({ name: 'orders' })
@Index(ORDERS_IDEMPOTENCY_UNIQUE_INDEX, ['customerId', 'idempotencyKey'], {
  unique: true,
})
@Index('IDX_orders_status_expires_at', ['status', 'expiresAt'])
@Index('IDX_orders_customer_created_at', ['customerId', 'createdAt'])
@Check(
  'CHK_orders_amounts_non_negative',
  '"subtotal_cents" >= 0 AND "discount_cents" >= 0',
)
@Check(
  'CHK_orders_discount_within_subtotal',
  '"discount_cents" <= "subtotal_cents"',
)
@Check(
  'CHK_orders_total_consistent',
  '"total_cents" = "subtotal_cents" - "discount_cents"',
)
@Check(
  'CHK_orders_paid_at_consistent',
  `("status" = 'paid') = ("paid_at" IS NOT NULL)`,
)
export class OrderOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_orders' })
  id: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  // Por nome: FKs sem importar a infraestrutura de outros módulos.
  @ManyToOne('UserOrmEntity', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'customer_id',
    foreignKeyConstraintName: 'FK_orders_customer',
  })
  customer?: unknown;

  @Index('IDX_orders_event_id')
  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @ManyToOne('EventOrmEntity', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'event_id', foreignKeyConstraintName: 'FK_orders_event' })
  event?: unknown;

  @Index('IDX_orders_coupon_id')
  @Column({ name: 'coupon_id', type: 'uuid', nullable: true })
  couponId: string | null;

  @ManyToOne('CouponOrmEntity', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'coupon_id',
    foreignKeyConstraintName: 'FK_orders_coupon',
  })
  coupon?: unknown;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    enumName: 'order_status',
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({ name: 'subtotal_cents', type: 'integer' })
  subtotalCents: number;

  @Column({ name: 'discount_cents', type: 'integer' })
  discountCents: number;

  @Column({ name: 'total_cents', type: 'integer' })
  totalCents: number;

  @Column({ name: 'idempotency_key', type: 'uuid' })
  idempotencyKey: string;

  @Column({ name: 'request_hash', type: 'char', length: 64 })
  requestHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
