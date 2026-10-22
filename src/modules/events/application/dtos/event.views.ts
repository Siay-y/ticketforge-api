import type { Event } from '../../domain/entities/event.js';
import type { TicketBatch } from '../../domain/entities/ticket-batch.js';
import type { EventStatus } from '../../domain/value-objects/event-status.js';

export interface TicketBatchView {
  id: string;
  name: string;
  unitPriceCents: number;
  totalQuantity: number;
  availableQuantity: number;
  soldQuantity: number;
  salesStartDate: Date;
  salesEndDate: Date;
}

export interface EventSummaryView {
  id: string;
  slug: string;
  title: string;
  venue: string;
  eventDate: Date;
  status: EventStatus;
}

export interface EventDetailsView extends EventSummaryView {
  description: string;
  maxCapacity: number;
  allocatedQuantity: number;
  organizerId: string;
  batches: TicketBatchView[];
  createdAt: Date;
  updatedAt: Date;
}

export const toTicketBatchView = (batch: TicketBatch): TicketBatchView => ({
  id: batch.id,
  name: batch.name,
  unitPriceCents: batch.unitPriceCents,
  totalQuantity: batch.totalQuantity,
  availableQuantity: batch.availableQuantity,
  soldQuantity: batch.soldQuantity,
  salesStartDate: batch.salesStartDate,
  salesEndDate: batch.salesEndDate,
});

export const toEventDetailsView = (event: Event): EventDetailsView => ({
  id: event.id,
  slug: event.slug.value,
  title: event.title,
  venue: event.venue,
  eventDate: event.eventDate,
  status: event.status,
  description: event.description,
  maxCapacity: event.maxCapacity,
  allocatedQuantity: event.allocatedQuantity,
  organizerId: event.organizerId,
  batches: event.batches.map(toTicketBatchView),
  createdAt: event.createdAt,
  updatedAt: event.updatedAt,
});
