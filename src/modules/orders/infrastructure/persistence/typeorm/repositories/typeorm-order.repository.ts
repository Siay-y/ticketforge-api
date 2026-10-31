import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { UnitOfWork } from '../../../../../../shared/application/unit-of-work.js';
import { isUniqueViolation } from '../../../../../../shared/infrastructure/persistence/typeorm/postgres-errors.js';
import { TransactionContext } from '../../../../../../shared/infrastructure/persistence/typeorm/typeorm-unit-of-work.js';
import type { Order } from '../../../../domain/entities/order.js';
import { DuplicateIdempotencyKeyError } from '../../../../domain/errors/duplicate-idempotency-key.error.js';
import { OrderNotFoundError } from '../../../../domain/errors/order-not-found.error.js';
import type { OrderRepository } from '../../../../domain/repositories/order.repository.js';
import {
  ORDERS_IDEMPOTENCY_UNIQUE_INDEX,
  OrderOrmEntity,
} from '../entities/order.orm-entity.js';
import { OrderItemOrmEntity } from '../entities/order-item.orm-entity.js';
import { OrderMapper } from '../mappers/order.mapper.js';

@Injectable()
export class TypeOrmOrderRepository implements OrderRepository {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly transaction: TransactionContext,
  ) {}

  async acquireIdempotencyLock(
    customerId: string,
    idempotencyKey: string,
  ): Promise<void> {
    // Lock de transação: liberado no commit ou rollback.
    await this.transaction.transactionalManager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`order:${customerId}:${idempotencyKey}`],
    );
  }

  async findByIdempotencyKey(
    customerId: string,
    idempotencyKey: string,
  ): Promise<Order | null> {
    const manager = this.transaction.manager;
    const row = await manager.findOneBy(OrderOrmEntity, {
      customerId,
      idempotencyKey,
    });

    return row ? this.withItems(manager, row) : null;
  }

  async create(order: Order): Promise<void> {
    const manager = this.transaction.transactionalManager;

    try {
      await manager.insert(OrderOrmEntity, OrderMapper.toRow(order));
    } catch (error) {
      if (isUniqueViolation(error, ORDERS_IDEMPOTENCY_UNIQUE_INDEX)) {
        throw new DuplicateIdempotencyKeyError();
      }

      throw error;
    }

    await manager.insert(OrderItemOrmEntity, OrderMapper.toItemRows(order));
  }

  update<T>(
    orderId: string,
    change: (order: Order) => T | Promise<T>,
  ): Promise<T> {
    return this.unitOfWork.run(async () => {
      const manager = this.transaction.transactionalManager;
      const row = await manager.findOne(OrderOrmEntity, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!row) {
        throw new OrderNotFoundError();
      }

      const order = await this.withItems(manager, row);
      const result = await change(order);

      await manager.update(
        OrderOrmEntity,
        { id: order.id },
        {
          status: order.status,
          paidAt: order.paidAt,
          updatedAt: order.updatedAt,
        },
      );

      return result;
    });
  }

  private async withItems(
    manager: EntityManager,
    row: OrderOrmEntity,
  ): Promise<Order> {
    const items = await manager.find(OrderItemOrmEntity, {
      where: { orderId: row.id },
      order: { batchId: 'ASC' },
    });

    return OrderMapper.toDomain(row, items);
  }
}
