import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { OrderOrmEntity } from './order.orm-entity.js';

@Entity({ name: 'order_items' })
@Index('UQ_order_items_order_batch', ['orderId', 'batchId'], { unique: true })
@Check('CHK_order_items_quantity_positive', '"quantity" > 0')
@Check('CHK_order_items_unit_price_non_negative', '"unit_price_cents" >= 0')
@Check(
  'CHK_order_items_total_consistent',
  '"total_price_cents" = "quantity" * "unit_price_cents"',
)
export class OrderItemOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_order_items' })
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => OrderOrmEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'order_id',
    foreignKeyConstraintName: 'FK_order_items_order',
  })
  order?: OrderOrmEntity;

  @Index('IDX_order_items_batch_id')
  @Column({ name: 'batch_id', type: 'uuid' })
  batchId: string;

  @ManyToOne('TicketBatchOrmEntity', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'batch_id',
    foreignKeyConstraintName: 'FK_order_items_batch',
  })
  batch?: unknown;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ name: 'unit_price_cents', type: 'integer' })
  unitPriceCents: number;

  @Column({ name: 'total_price_cents', type: 'integer' })
  totalPriceCents: number;
}
