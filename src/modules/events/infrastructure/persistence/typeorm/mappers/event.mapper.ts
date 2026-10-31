import { Event } from '../../../../domain/entities/event.js';
import { TicketBatch } from '../../../../domain/entities/ticket-batch.js';
import { Slug } from '../../../../domain/value-objects/slug.js';
import type { EventOrmEntity } from '../entities/event.orm-entity.js';
import type { TicketBatchOrmEntity } from '../entities/ticket-batch.orm-entity.js';

// Literais: só colunas entram no INSERT/UPDATE, sem relações nem `version`.
export type EventRow = Omit<EventOrmEntity, 'organizer'>;
export type TicketBatchRow = Omit<TicketBatchOrmEntity, 'event' | 'version'>;

export const TicketBatchMapper = {
  toDomain(row: TicketBatchOrmEntity): TicketBatch {
    return TicketBatch.restore({
      id: row.id,
      eventId: row.eventId,
      name: row.name,
      unitPriceCents: row.unitPriceCents,
      totalQuantity: row.totalQuantity,
      availableQuantity: row.availableQuantity,
      salesStartDate: row.salesStartDate,
      salesEndDate: row.salesEndDate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toRow(batch: TicketBatch): TicketBatchRow {
    return {
      id: batch.id,
      eventId: batch.eventId,
      name: batch.name,
      unitPriceCents: batch.unitPriceCents,
      totalQuantity: batch.totalQuantity,
      availableQuantity: batch.availableQuantity,
      salesStartDate: batch.salesStartDate,
      salesEndDate: batch.salesEndDate,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    };
  },
};

export const EventMapper = {
  toDomain(row: EventOrmEntity, batchRows: TicketBatchOrmEntity[]): Event {
    return Event.restore({
      id: row.id,
      organizerId: row.organizerId,
      title: row.title,
      slug: Slug.restore(row.slug),
      description: row.description,
      venue: row.venue,
      eventDate: row.eventDate,
      maxCapacity: row.maxCapacity,
      status: row.status,
      batches: batchRows.map((batch) => TicketBatchMapper.toDomain(batch)),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  },

  toEventRow(event: Event): EventRow {
    return {
      id: event.id,
      organizerId: event.organizerId,
      title: event.title,
      slug: event.slug.value,
      description: event.description,
      venue: event.venue,
      eventDate: event.eventDate,
      maxCapacity: event.maxCapacity,
      status: event.status,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      deletedAt: event.deletedAt,
    };
  },

  toBatchRows(event: Event): TicketBatchRow[] {
    return event.batches.map((batch) => TicketBatchMapper.toRow(batch));
  },
};
