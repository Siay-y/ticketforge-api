import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { TransactionContext } from '../../../../../../shared/infrastructure/persistence/typeorm/typeorm-unit-of-work.js';
import type { TicketBatch } from '../../../../domain/entities/ticket-batch.js';
import type {
  EventSaleStatus,
  TicketStockRepository,
} from '../../../../domain/repositories/ticket-stock.repository.js';
import { EventOrmEntity } from '../entities/event.orm-entity.js';
import { TicketBatchOrmEntity } from '../entities/ticket-batch.orm-entity.js';
import { TicketBatchMapper } from '../mappers/event.mapper.js';

@Injectable()
export class TypeOrmTicketStockRepository implements TicketStockRepository {
  constructor(private readonly transaction: TransactionContext) {}

  async lockBatches(batchIds: string[]): Promise<TicketBatch[]> {
    if (batchIds.length === 0) {
      return [];
    }

    // O Postgres trava na ordem do ORDER BY: mesma sequência em todo pedido.
    const rows = await this.transaction.transactionalManager.find(
      TicketBatchOrmEntity,
      {
        where: { id: In(batchIds) },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      },
    );

    return rows.map((row) => TicketBatchMapper.toDomain(row));
  }

  async findEventSaleStatus(eventId: string): Promise<EventSaleStatus | null> {
    const row = await this.transaction.manager.findOne(EventOrmEntity, {
      where: { id: eventId },
      select: { id: true, status: true, eventDate: true },
    });

    return row ? { status: row.status, eventDate: row.eventDate } : null;
  }

  async saveStock(batches: TicketBatch[]): Promise<void> {
    for (const batch of batches) {
      // O TypeORM incrementa `version` sozinho.
      await this.transaction.manager.update(
        TicketBatchOrmEntity,
        { id: batch.id },
        {
          availableQuantity: batch.availableQuantity,
          updatedAt: batch.updatedAt,
        },
      );
    }
  }
}
