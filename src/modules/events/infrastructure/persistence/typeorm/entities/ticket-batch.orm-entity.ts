import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  VersionColumn,
} from 'typeorm';
import { EventOrmEntity } from './event.orm-entity.js';

@Entity({ name: 'ticket_batches' })
// Regras do domínio repetidas no banco.
@Check('CHK_ticket_batches_total_quantity_positive', '"total_quantity" > 0')
@Check(
  'CHK_ticket_batches_available_quantity_range',
  '"available_quantity" >= 0 AND "available_quantity" <= "total_quantity"',
)
@Check('CHK_ticket_batches_unit_price_non_negative', '"unit_price_cents" >= 0')
@Check(
  'CHK_ticket_batches_sales_period',
  '"sales_start_date" < "sales_end_date"',
)
export class TicketBatchOrmEntity {
  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_ticket_batches',
  })
  id: string;

  @Index('IDX_ticket_batches_event_id')
  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @ManyToOne(() => EventOrmEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'event_id',
    foreignKeyConstraintName: 'FK_ticket_batches_event',
  })
  event?: EventOrmEntity;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'unit_price_cents', type: 'integer' })
  unitPriceCents: number;

  @Column({ name: 'total_quantity', type: 'integer' })
  totalQuantity: number;

  @Column({ name: 'available_quantity', type: 'integer' })
  availableQuantity: number;

  @Column({ name: 'sales_start_date', type: 'timestamptz' })
  salesStartDate: Date;

  @Column({ name: 'sales_end_date', type: 'timestamptz' })
  salesEndDate: Date;

  @VersionColumn()
  version: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
