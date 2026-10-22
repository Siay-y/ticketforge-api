import type { Event } from '../entities/event.js';

/** Porta de escrita do agregado Event (evento e seus lotes). */
export abstract class EventRepository {
  /** Grava evento e lotes iniciais numa única transação: ou entra tudo, ou nada. */
  abstract create(event: Event): Promise<void>;

  /**
   * Carrega o evento com lock exclusivo, aplica `change` e persiste na mesma
   * transação. Qualquer erro em `change` desfaz tudo. Lança `EventNotFoundError`.
   */
  abstract update<T>(eventId: string, change: (event: Event) => T): Promise<T>;
}
