import { Injectable } from '@nestjs/common';
import { TicketInventoryService } from '../../../events/application/services/ticket-inventory.service.js';
import { OrderRepository } from '../../domain/repositories/order.repository.js';
import { type OrderView, toOrderView } from '../dtos/order.views.js';
import {
  type Actor,
  assertCanAccessOrder,
} from '../policies/order-access.policy.js';

@Injectable()
export class CancelOrderUseCase {
  constructor(
    private readonly orders: OrderRepository,
    private readonly inventory: TicketInventoryService,
  ) {}

  execute(actor: Actor, orderId: string): Promise<OrderView> {
    return this.orders.update(orderId, async (order) => {
      assertCanAccessOrder(order, actor);

      const now = new Date();

      order.cancel(now);
      await this.inventory.release(
        {
          lines: order.items.map(({ batchId, quantity }) => ({
            batchId,
            quantity,
          })),
          couponId: order.couponId,
        },
        now,
      );

      return toOrderView(order);
    });
  }
}
