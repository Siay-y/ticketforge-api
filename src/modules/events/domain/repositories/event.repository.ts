import type { Event } from '../entities/event.js';

export abstract class EventRepository {
  /** Evento e lotes numa única transação. */
  abstract create(event: Event): Promise<void>;

  abstract findById(eventId: string): Promise<Event | null>;

  /** Carrega com `FOR UPDATE`, aplica `change` e grava na mesma transação. Lança `EventNotFoundError`. */
  abstract update<T>(eventId: string, change: (event: Event) => T): Promise<T>;
}
