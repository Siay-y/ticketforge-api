import type { TicketBatch } from '../entities/ticket-batch.js';
import type { EventStatus } from '../value-objects/event-status.js';

export interface EventSaleStatus {
  status: EventStatus;
  eventDate: Date;
}

/** Caminho quente da venda: só o estoque, sem travar o agregado Event. */
export abstract class TicketStockRepository {
  /** `FOR UPDATE` em ordem de id (evita deadlock); exige transação ativa. */
  abstract lockBatches(batchIds: string[]): Promise<TicketBatch[]>;

  /** `null` se inexistente ou removido. */
  abstract findEventSaleStatus(
    eventId: string,
  ): Promise<EventSaleStatus | null>;

  abstract saveStock(batches: TicketBatch[]): Promise<void>;
}
