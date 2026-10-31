import { Injectable } from '@nestjs/common';
import { OrderNotFoundError } from '../../domain/errors/order-not-found.error.js';
import type { OrderView } from '../dtos/order.views.js';
import { OrderQueries } from '../ports/order-queries.js';
import {
  type Actor,
  assertCanAccessOrder,
} from '../policies/order-access.policy.js';

@Injectable()
export class GetOrderUseCase {
  constructor(private readonly queries: OrderQueries) {}

  async execute(actor: Actor, orderId: string): Promise<OrderView> {
    const order = await this.queries.findById(orderId);

    if (!order) {
      throw new OrderNotFoundError();
    }

    assertCanAccessOrder(order, actor);

    return order;
  }
}
