import { Event } from '../domain/entities/event.js';
import { TicketBatch } from '../domain/entities/ticket-batch.js';
import { EventNotFoundError } from '../domain/errors/event-not-found.error.js';
import type { EventRepository } from '../domain/repositories/event.repository.js';

/** Guarda cópias: erro em `change` não grava nada, como um rollback. */
export class InMemoryEventRepository implements EventRepository {
  private readonly events = new Map<string, Event>();

  create(event: Event): Promise<void> {
    this.events.set(event.id, clone(event));

    return Promise.resolve();
  }

  findById(eventId: string): Promise<Event | null> {
    const stored = this.events.get(eventId);

    return Promise.resolve(stored && !stored.deletedAt ? clone(stored) : null);
  }

  async update<T>(eventId: string, change: (event: Event) => T): Promise<T> {
    const stored = this.events.get(eventId);

    if (!stored || stored.deletedAt) {
      throw new EventNotFoundError();
    }

    const working = clone(stored);
    const result = change(working);

    this.events.set(eventId, working);

    return Promise.resolve(result);
  }

  get(eventId: string): Event | undefined {
    const event = this.events.get(eventId);

    return event && clone(event);
  }
}

const clone = (event: Event): Event =>
  Event.restore({
    id: event.id,
    organizerId: event.organizerId,
    title: event.title,
    slug: event.slug,
    description: event.description,
    venue: event.venue,
    eventDate: event.eventDate,
    maxCapacity: event.maxCapacity,
    status: event.status,
    batches: event.batches.map((batch) =>
      TicketBatch.restore({
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
      }),
    ),
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    deletedAt: event.deletedAt,
  });
