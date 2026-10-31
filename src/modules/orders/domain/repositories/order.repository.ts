import type { Order } from '../entities/order.js';

export abstract class OrderRepository {
  /** Serializa requisições com a mesma chave até o fim da transação. */
  abstract acquireIdempotencyLock(
    customerId: string,
    idempotencyKey: string,
  ): Promise<void>;

  abstract findByIdempotencyKey(
    customerId: string,
    idempotencyKey: string,
  ): Promise<Order | null>;

  /** Lança `DuplicateIdempotencyKeyError` se a chave já existir. */
  abstract create(order: Order): Promise<void>;

  /** `FOR UPDATE`, aplica `change` e grava na transação corrente. Lança `OrderNotFoundError`. */
  abstract update<T>(
    orderId: string,
    change: (order: Order) => T | Promise<T>,
  ): Promise<T>;
}
