import {
  Check,
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { EventStatus } from '../../../../domain/value-objects/event-status.js';

export const EVENTS_SLUG_UNIQUE_INDEX = 'UQ_events_slug';

@Entity({ name: 'events' })
@Index('IDX_events_status_event_date', ['status', 'eventDate'], {
  where: '"deleted_at" IS NULL',
})
@Check('CHK_events_max_capacity_positive', '"max_capacity" > 0')
export class EventOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_events' })
  id: string;

  @Index('IDX_events_organizer_id')
  @Column({ name: 'organizer_id', type: 'uuid' })
  organizerId: string;

  // Por nome: FK sem importar a infraestrutura de users.
  @ManyToOne('UserOrmEntity', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'organizer_id',
    foreignKeyConstraintName: 'FK_events_organizer',
  })
  organizer?: unknown;

  // GIN trigram criado na migration; synchronize: false impede o descarte.
  @Index('IDX_events_title_trgm', { synchronize: false })
  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Index(EVENTS_SLUG_UNIQUE_INDEX, { unique: true })
  @Column({ type: 'varchar', length: 100 })
  slug: string;

  @Column({ type: 'text' })
  description: string;

  @Index('IDX_events_venue_trgm', { synchronize: false })
  @Column({ type: 'varchar', length: 200 })
  venue: string;

  @Column({ name: 'event_date', type: 'timestamptz' })
  eventDate: Date;

  @Column({ name: 'max_capacity', type: 'integer' })
  maxCapacity: number;

  @Column({
    type: 'enum',
    enum: EventStatus,
    enumName: 'event_status',
    default: EventStatus.DRAFT,
  })
  status: EventStatus;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
