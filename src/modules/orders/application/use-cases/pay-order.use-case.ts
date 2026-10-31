import { Injectable } from '@nestjs/common';
import { OrderRepository } from '../../domain/repositories/order.repository.js';
import { type OrderView, toOrderView } from '../dtos/order.views.js';
import {
  type Actor,
  assertIsOrderOwner,
} from '../policies/order-access.policy.js';

@Injectable()
export class PayOrderUseCase {
  constructor(private readonly orders: OrderRepository) {}

  /** Simula o gateway; na Sessão 5 dispara a emissão dos ingressos. */
  execute(actor: Actor, orderId: string): Promise<OrderView> {
    return this.orders.update(orderId, (order) => {
      assertIsOrderOwner(order, actor);
      order.pay(new Date());

      return toOrderView(order);
    });
  }
}
