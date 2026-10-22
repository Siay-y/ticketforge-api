import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import type { Event } from '../../../../domain/entities/event.js';
import { EventNotFoundError } from '../../../../domain/errors/event-not-found.error.js';
import type { EventRepository } from '../../../../domain/repositories/event.repository.js';
import { EventOrmEntity } from '../entities/event.orm-entity.js';
import { TicketBatchOrmEntity } from '../entities/ticket-batch.orm-entity.js';
import { EventMapper, type TicketBatchRow } from '../mappers/event.mapper.js';

@Injectable()
export class TypeOrmEventRepository implements EventRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(event: Event): Promise<void> {
    const batches = EventMapper.toBatchRows(event);

    await this.dataSource.transaction(async (manager) => {
      await manager.insert(EventOrmEntity, EventMapper.toEventRow(event));

      if (batches.length > 0) {
        await manager.insert(TicketBatchOrmEntity, batches);
      }
    });
  }

  update<T>(eventId: string, change: (event: Event) => T): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      // SELECT ... FOR UPDATE no evento e nos lotes: alterações concorrentes no
      // mesmo evento esperam a vez, e a soma de capacidade nunca é lida obsoleta.
      const eventRow = await manager.findOne(EventOrmEntity, {
        where: { id: eventId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!eventRow) {
        throw new EventNotFoundError();
      }

      const batchRows = await manager.find(TicketBatchOrmEntity, {
        where: { eventId },
        order: { createdAt: 'ASC', id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });

      const event = EventMapper.toDomain(eventRow, batchRows);
      const result = change(event);

      await this.persist(manager, event, batchRows);

      return result;
    });
  }

  private async persist(
    manager: EntityManager,
    event: Event,
    previousBatches: TicketBatchOrmEntity[],
  ): Promise<void> {
    const { id, ...eventChanges } = EventMapper.toEventRow(event);
    const previous = new Map(previousBatches.map((row) => [row.id, row]));

    await manager.update(EventOrmEntity, { id }, eventChanges);

    for (const row of EventMapper.toBatchRows(event)) {
      const before = previous.get(row.id);

      if (!before) {
        await manager.insert(TicketBatchOrmEntity, row);
      } else if (hasChanged(before, row)) {
        const {
          id: batchId,
          eventId: _eventId,
          createdAt: _createdAt,
          ...changes
        } = row;

        // O TypeORM acrescenta `version = version + 1` sozinho neste UPDATE.
        await manager.update(TicketBatchOrmEntity, { id: batchId }, changes);
      }
    }
  }
}

function hasChanged(
  before: TicketBatchOrmEntity,
  after: TicketBatchRow,
): boolean {
  return (
    before.name !== after.name ||
    before.unitPriceCents !== after.unitPriceCents ||
    before.totalQuantity !== after.totalQuantity ||
    before.availableQuantity !== after.availableQuantity ||
    before.salesStartDate.getTime() !== after.salesStartDate.getTime() ||
    before.salesEndDate.getTime() !== after.salesEndDate.getTime()
  );
}
