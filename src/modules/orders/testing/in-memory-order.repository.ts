import type { Order } from '../domain/entities/order.js';
import { DuplicateIdempotencyKeyError } from '../domain/errors/duplicate-idempotency-key.error.js';
import { OrderNotFoundError } from '../domain/errors/order-not-found.error.js';
import type { OrderRepository } from '../domain/repositories/order.repository.js';

export class InMemoryOrderRepository implements OrderRepository {
  readonly orders = new Map<string, Order>();
  /** Simula a corrida perdida: o próximo `create` falha. */
  raceWinner?: Order;

  acquireIdempotencyLock(): Promise<void> {
    return Promise.resolve();
  }

  findByIdempotencyKey(
    customerId: string,
    idempotencyKey: string,
  ): Promise<Order | null> {
    const found = [...this.orders.values()].find(
      (order) =>
        order.customerId === customerId &&
        order.idempotencyKey === idempotencyKey,
    );

    return Promise.resolve(found ?? null);
  }

  create(order: Order): Promise<void> {
    if (this.raceWinner) {
      this.orders.set(this.raceWinner.id, this.raceWinner);
      this.raceWinner = undefined;

      return Promise.reject(new DuplicateIdempotencyKeyError());
    }

    this.orders.set(order.id, order);

    return Promise.resolve();
  }

  async update<T>(
    orderId: string,
    change: (order: Order) => T | Promise<T>,
  ): Promise<T> {
    const order = this.orders.get(orderId);

    if (!order) {
      throw new OrderNotFoundError();
    }

    return change(order);
  }
}
